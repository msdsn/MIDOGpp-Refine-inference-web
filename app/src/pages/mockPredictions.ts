
interface Prediction {
  bbox: [number, number, number, number];
  confidence: number;
  class_id: number;
}

const mockPredictions: Prediction[] = [
  {
    bbox: [300, 300, 340, 340],
    confidence: 0.9,
    class_id: 0,
  }
];

export { mockPredictions, type Prediction };