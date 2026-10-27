import { LiveError } from "../errors";
import { OperationGroup } from "./group";
import { OperationKind, type OpArgs, type OpRun, type OperationTable } from "./operation";

type SimplerOp = "simpler_get_sample" | "simpler_replace_sample";

/** The sample loaded in a Simpler. */
export class SimplerOperations extends OperationGroup<SimplerOp> {
  table(): OperationTable<SimplerOp> {
    return {
      simpler_get_sample: { kind: OperationKind.Read, prepare: (args) => this.getSample(args) },
      simpler_replace_sample: { kind: OperationKind.Change, prepare: (args) => this.replaceSample(args) },
    };
  }

  private getSample({ device }: OpArgs<"simpler_get_sample">): OpRun<"simpler_get_sample"> {
    const simpler = this.refs.simpler(device);
    return async () => ({ filePath: simpler.sample?.filePath ?? null });
  }

  private replaceSample({ device, filePath }: OpArgs<"simpler_replace_sample">): OpRun<"simpler_replace_sample"> {
    const simpler = this.refs.simpler(device);
    OperationGroup.checkFile(filePath);
    return async () => {
      const sample = await LiveError.guard(simpler.replaceSample(filePath), "replace the sample");
      return { filePath: sample.filePath };
    };
  }
}
