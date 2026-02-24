import * as tf from '@tensorflow/tfjs';

let cachedModel = null;
const WEIGHT_DATA_URL = 'https://manueledim.github.io/energy-detective-model/group1-shard1of1.bin';

export const loadAndPredict = async (dataWindow) => {
  try {
    if (!dataWindow || dataWindow.length !== 60) return null;

    if (!cachedModel) {
      console.log("INITIALIZING: High-Performance 128-Unit Engine...");

      const model = tf.sequential();
      
      // We use 'glorotUniform' to prevent the 65,536 element warning
      model.add(tf.layers.lstm({ 
        units: 128, 
        returnSequences: true, 
        inputShape: [60, 1],
        kernelInitializer: 'glorotUniform'
      }));
      model.add(tf.layers.batchNormalization());
      
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
      const tensors = model.getWeights().map(w => {
        const size = w.size;
        const slice = weightData.slice(offset, offset + size);
        const tensor = tf.tensor(slice, w.shape);
        offset += size;
        return tensor;
      });

      model.setWeights(tensors);
      cachedModel = model;
      console.log("SUCCESS: 20W Fridge Detective is LIVE.");
    }

    const result = tf.tidy(() => {
      const cleanData = Array.from(dataWindow).map(val => {
        const num = Number(val);
        return isNaN(num) ? 0 : num;
      });

      const input = tf.tensor3d(cleanData, [1, 60, 1]);
      return cachedModel.predict(input).dataSync()[0];
    });

    return { rawValue: result, isOn: result > 0.02 };

  } catch (error) {
    console.error("DASHBOARD STATUS:", error.message);
    return null;
  }
};