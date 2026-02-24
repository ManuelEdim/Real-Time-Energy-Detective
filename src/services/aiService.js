import * as tf from '@tensorflow/tfjs';

let cachedModel = null;
const WEIGHT_DATA_URL = 'https://manueledim.github.io/energy-detective-model/group1-shard1of1.bin';

export const loadAndPredict = async (dataWindow) => {
  try {
    if (!dataWindow || dataWindow.length !== 60) return null;

    if (!cachedModel) {
      console.log("INITIALIZING: High-Performance 128-Unit Engine...");

      const model = tf.sequential();
      
      // Layer 1: 128-unit Bi-LSTM shell
      model.add(tf.layers.lstm({ 
        units: 128, 
        returnSequences: true, 
        inputShape: [60, 1],
        kernelInitializer: 'glorotUniform'
      }));
      model.add(tf.layers.batchNormalization());
      
      // Layer 2: 128-unit logic for 20W signature detection
      model.add(tf.layers.lstm({ 
        units: 128,
        kernelInitializer: 'glorotUniform'
      }));
      model.add(tf.layers.batchNormalization());
      
      model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
      model.add(tf.layers.dense({ units: 1 }));

      const response = await fetch(WEIGHT_DATA_URL);
      const buffer = await response.arrayBuffer();
      const weightData = new Float32Array(buffer);

      let offset = 0;
      const tensors = [];
      
      // Yield to browser after each large weight creation to prevent page lockup
      for (const w of model.getWeights()) {
        const size = w.size;
        const slice = weightData.slice(offset, offset + size);
        const tensor = tf.tensor(slice, w.shape);
        tensors.push(tensor);
        offset += size;
        
        await tf.nextFrame(); 
      }

      model.setWeights(tensors);
      
      // Memory Management: Dispose of intermediate tensors
      tensors.forEach(t => t.dispose()); 
      
      cachedModel = model;
      console.log("SUCCESS: 20W Fridge Detective is LIVE.");
    }

    // Strict memory isolation for the prediction cycle
    const resultValue = tf.tidy(() => {
      const cleanData = Array.from(dataWindow).map(val => {
        const num = Number(val);
        return isNaN(num) ? 0 : num;
      });

      const input = tf.tensor3d(cleanData, [1, 60, 1]);
      const prediction = cachedModel.predict(input);
      
      // Pull value out and ensure it's a valid number
      const val = prediction.dataSync()[0];
      return isNaN(val) ? 0 : val;
    });

    // RECOMMENDATION: Explicitly cast to Number to prevent NaN% in the UI
    const finalResult = Number(resultValue);

    return { 
      rawValue: finalResult, 
      isOn: finalResult > 0.02, 
      // Calculated confidence based on your 20W threshold
      confidence: `${(Math.min(finalResult * 100, 99.9)).toFixed(1)}%` 
    };

  } catch (error) {
    console.error("DASHBOARD STATUS:", error.message);
    return { rawValue: 0, isOn: false, confidence: "0.0%" };
  }
};