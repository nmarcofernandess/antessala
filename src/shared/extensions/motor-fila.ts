export const MOTOR_FILA_SPEC_PATH = 'specs/002-motor-da-fila/' as const

/**
 * Ponto de encaixe intencionalmente vazio para o motor da fila.
 *
 * `specs/002-motor-da-fila/` é dona dos tipos de domínio, transições,
 * cálculo de espera e ordenação. Esta preparação não antecipa nenhum deles.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MotorFilaExtensionPoint {}

export const MOTOR_FILA_EXTENSION_POINT: Readonly<MotorFilaExtensionPoint> = Object.freeze({})
