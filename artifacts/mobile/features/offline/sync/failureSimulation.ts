export type FailureSimulation = { failNext?: number; latencyMs?: number; errorMessage?: string };
let simulation: FailureSimulation = {};

export function setOfflineFailureSimulation(next: FailureSimulation) {
  if (!__DEV__) return;
  simulation = { ...next };
}

export async function consumeOfflineFailureSimulation() {
  if (!__DEV__) return;
  if (simulation.latencyMs) await new Promise(resolve => setTimeout(resolve, simulation.latencyMs));
  if (simulation.failNext && simulation.failNext > 0) {
    simulation = { ...simulation, failNext: simulation.failNext - 1 };
    throw new Error(simulation.errorMessage ?? 'Simulated offline sync failure');
  }
}