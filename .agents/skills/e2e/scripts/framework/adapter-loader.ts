import { pathToFileURL } from 'node:url'
import type { E2eProjectAdapter } from './adapter-types'
import { adapterModulePath } from './project-config'
import type { ProjectE2eConfig } from './project-config'

export async function loadProjectAdapter(
  repoRoot: string,
  config: ProjectE2eConfig
): Promise<E2eProjectAdapter> {
  const modulePath = adapterModulePath(repoRoot, config)
  const mod = (await import(pathToFileURL(modulePath).href)) as {
    default?: E2eProjectAdapter
    adapter?: E2eProjectAdapter
    createAdapter?: () => E2eProjectAdapter
  }
  const adapter = mod.default ?? mod.adapter ?? mod.createAdapter?.()
  if (!adapter?.createExecutor) {
    throw new Error(
      `Adapter ${modulePath} must export default, adapter, or createAdapter() with createExecutor()`
    )
  }
  return adapter
}
