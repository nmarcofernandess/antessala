import { assertIaRouteReady, resolveIaRoute } from './routing'
import type { AiRouteReadinessReason, AiRouteTask } from '../../shared/ia-routing-contract'
import type { IaConfiguracao } from '../../shared/types'

export type IaChatReadinessReason = AiRouteReadinessReason

export interface IaChatReadiness {
  ok: boolean
  provider: IaConfiguracao['provider'] | null
  model: string | null
  reason: IaChatReadinessReason
  message: string
  action?: string
  task?: AiRouteTask
  label?: string
  inherited?: boolean
  auto_selected?: boolean
}

export async function getIaTaskReadiness(
  task: AiRouteTask,
  options: { validateLocal?: boolean } = {},
): Promise<IaChatReadiness> {
  const route = await resolveIaRoute(task, options)
  return {
    ok: route.ok,
    provider: route.provider,
    model: route.model,
    reason: route.reason,
    message: route.message,
    ...(route.action ? { action: route.action } : {}),
    task: route.task,
    label: route.label,
    inherited: route.inherited,
    auto_selected: route.auto_selected,
  }
}

export async function getIaChatReadiness(options: { validateLocal?: boolean } = {}): Promise<IaChatReadiness> {
  return getIaTaskReadiness('chat_ui', options)
}

export async function assertIaCanChat(): Promise<IaChatReadiness> {
  const route = await assertIaRouteReady('chat_ui', { validateLocal: true })
  return {
    ok: true,
    provider: route.provider,
    model: route.model,
    reason: route.reason,
    message: route.message,
    ...(route.action ? { action: route.action } : {}),
    task: route.task,
    label: route.label,
    inherited: route.inherited,
    auto_selected: route.auto_selected,
  }
}
