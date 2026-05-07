import type { RoomErrorCode, TransferProfile, TransferRole } from './types'

export interface RoomPresence {
  sender: number
  receiver: number
}

export type JoinPlan =
  | {
      ok: true
      mode: TransferProfile
      roomReady: boolean
      becameReady: boolean
    }
  | {
      ok: false
      code: RoomErrorCode
    }

export function normalizeRequestedMode(raw: string | null): TransferProfile | null {
  return raw === 'local' || raw === 'webrtc' ? raw : null
}

export function isRoomReady(presence: RoomPresence): boolean {
  return presence.sender > 0 && presence.receiver > 0
}

export function planJoin(
  presence: RoomPresence,
  role: TransferRole,
  requestedMode: TransferProfile | null,
  currentMode: TransferProfile | null
): JoinPlan {
  if (presence[role] > 0) {
    return { ok: false, code: 'ROOM_FULL' }
  }

  const mode = currentMode ?? requestedMode ?? 'webrtc'
  const roomReadyBeforeJoin = isRoomReady(presence)
  const nextPresence = {
    ...presence,
    [role]: presence[role] + 1,
  }
  const roomReady = isRoomReady(nextPresence)

  return {
    ok: true,
    mode,
    roomReady,
    becameReady: !roomReadyBeforeJoin && roomReady,
  }
}
