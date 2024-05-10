export default function checkWebGPUSupport(): boolean {
  const nav = navigator as Navigator & { gpu: unknown };
  return !!nav.gpu;
}
