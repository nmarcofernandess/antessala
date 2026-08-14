/**
 * Ponte para o modelo de resposta, que agora mora em `@shared`.
 *
 * Os tipos e predicados saíram do renderer porque o processo principal precisa
 * deles: quem calcula o requisito de agenda é o main, e o renderer não pode ser
 * autoridade de compatibilidade. Este arquivo continua existindo para que os
 * widgets importem do lugar de sempre.
 */
export * from '@shared/clinical/anamnese-tipos'
