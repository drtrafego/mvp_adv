/**
 * Adaptador Habblaud para o Escritório Virtual Daniel Felix Advocacia.
 * Reutiliza a lógica única de prototipo/src/habblaud-bridge.mjs para garantir
 * alinhamento 1:1 entre servidor SSE, build estático e cliente unificado.
 */
import { initialState } from '../prototipo/src/model.mjs';
import {
  HABBLAUD_ROOM_BY_SECTOR,
  SECTOR_BY_HABBLAUD_ROOM,
  buildHabblaudSnapshotFromState,
  buildHabblaudFeedFromState,
} from '../prototipo/src/habblaud-bridge.mjs';

export { HABBLAUD_ROOM_BY_SECTOR, SECTOR_BY_HABBLAUD_ROOM };

export function buildHabblaudSnapshot(officeState = {}) {
  const base = officeState && Array.isArray(officeState.agents) && officeState.agents.length > 0
    ? officeState
    : { ...initialState(), ...officeState };
  return buildHabblaudSnapshotFromState(base);
}

export function buildHabblaudFeed(officeState = {}) {
  const base = officeState && Array.isArray(officeState.agents) && officeState.agents.length > 0
    ? officeState
    : { ...initialState(), ...officeState };
  return buildHabblaudFeedFromState(base);
}
