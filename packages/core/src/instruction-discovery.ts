export * as InstructionDiscovery from "./instruction-discovery.js"

import { Context, Effect, Layer, Schema, Types } from "effect"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { Bus } from "./bus.js"
import { Instructions } from "./instructions/index.js"
import { State } from "./state.js"

export class File extends Schema.Class<File>("InstructionDiscovery.File")({
  // An absolute file path, or the URL of a configured remote instruction.
  path: Schema.String,
  content: Schema.String,
}) {}

export const Event = {
  Updated: Bus.ephemeral({ type: "instruction-discovery.updated", schema: {} }),
}

export type Data = {
  files: Map<string, Types.DeepMutable<File>>
  available: boolean
}

export type Editor = {
  list: () => readonly Types.DeepMutable<File>[]
  // Map insertion order is render order: config adds global then nearest-to-farthest project files;
  // sibling contributors interleave by transform registration order.
  add: (file: File) => void
  update: (path: string, update: (file: Types.DeepMutable<File>) => void) => void
  remove: (path: string) => void
  unavailable: () => void
}

export interface Interface extends State.Transformable<Editor> {
  // Discovery policy lives here because internal plugins have no per-composition options channel.
  // Move it into plugin config once plugins can consume their own options.
  readonly project: boolean
  readonly global: boolean
  readonly list: () => Effect.Effect<File[] | Instructions.Unavailable>
  readonly load: () => Effect.Effect<Instructions.List>
}

export const Options = Schema.Struct({
  project: Schema.optional(Schema.Boolean),
  global: Schema.optional(Schema.Boolean),
})
export type Options = typeof Options.Type

export class Service extends Context.Service<Service, Interface>()("@opencode/InstructionDiscovery") {}

export const layer = (options?: Options) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const bus = yield* Bus.Service
      const state = State.create<Data, Editor>({
        name: "instruction-discovery",
        initial: () => ({ files: new Map(), available: true }),
        editor: (editor) => ({
          list: () => Array.from(editor.files.values()),
          add: (file) => editor.files.set(file.path, new File(file) as Types.DeepMutable<File>),
          update: (path, update) => {
            const current = editor.files.get(path)
            if (!current) return
            update(current)
            current.path = path
          },
          remove: (path) => editor.files.delete(path),
          unavailable: () => {
            editor.available = false
          },
        }),
        notify: () => bus.publish(Event.Updated, {}).pipe(Effect.asVoid),
      })

      const list = Effect.fn("InstructionDiscovery.list")(function* () {
        const current = state.get()
        if (!current.available) return Instructions.unavailable
        return Array.from(current.files.values())
      })

      return Service.of({
        project: options?.project !== false,
        global: options?.global !== false,
        transform: state.transform,
        reload: state.reload,
        list,
        load: Effect.fn("InstructionDiscovery.load")(function* () {
          return Instructions.empty
        }),
      })
    }),
  )

export function configured(options?: Options) {
  return makeLocationNode({
    service: Service,
    layer: layer(options),
    deps: [Bus.node],
  })
}

export const node = configured()
