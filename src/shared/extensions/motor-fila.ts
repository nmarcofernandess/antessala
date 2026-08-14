export const MOTOR_FILA_SPEC_PATH =
  'hack/minispecs/002-capacidade-agenda-booking/' as const

/**
 * Ponto de encaixe legado, intencionalmente vazio.
 *
 * O produto antigo previa ordenação de fila física; essa hipótese foi invalidada. A
 * MiniSpec 003 decidirá o contrato de requisito/capacidade de agenda depois dos gates,
 * sem reutilizar este nome como decisão de domínio.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MotorFilaExtensionPoint {}

export const MOTOR_FILA_EXTENSION_POINT: Readonly<MotorFilaExtensionPoint> = Object.freeze({})
