export * as SkillInstructions from "./instructions.js"

import { makeLocationNode } from "@opencode/util/effect/app-node"
import { Context, Effect, Layer } from "effect"
import { Permission } from "../permission.js"
import { Instructions } from "../instructions/index.js"

export interface Interface {
  /** Loads skill guidance for the given agent and Session permissions. */
  readonly load: (permissions: Permission.Ruleset) => Effect.Effect<Instructions.List>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SkillInstructions") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    return Service.of({
      load: Effect.fn("SkillInstructions.load")(function* () {
        return Instructions.empty
      }),
    })
  }),
)

export const node = makeLocationNode({ service: Service, layer, deps: [] })