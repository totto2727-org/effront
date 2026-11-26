import { Array, Data, Predicate } from "effect";

interface FlightClientReference {
  exportName: string;
  moduleId: string;
}

class InvalidFlightRow extends Data.TaggedError("InvalidFlightRow")<{ message: string }> {}

const referencePrefix = "$";
const referencePrefixLength = 1;

const capture = (row: RegExpMatchArray, name: string): string => {
  const captured = row.groups?.[name];
  if (Predicate.isNullish(captured)) {
    throw new InvalidFlightRow({ message: `Expected Flight row capture ${name}` });
  }
  return captured;
};

const readStringRows = (body: string): Map<string, string> =>
  new Map(
    [...body.matchAll(/^(?<id>[0-9a-f]+):(?<value>"(?:\\.|[^"\\])*")$/gmu)].map((row) => {
      const id = capture(row, "id");
      const value: unknown = JSON.parse(capture(row, "value"));
      if (!Predicate.isString(value)) {
        throw new InvalidFlightRow({ message: `Expected a string in Flight row ${id}` });
      }
      return [id, value];
    }),
  );

export const flightClientReferences = (body: string): FlightClientReference[] => {
  const strings = readStringRows(body);
  return [...body.matchAll(/^[0-9a-f]+:I(?<value>\[.*\])$/gmu)].flatMap((row) => {
    const value: unknown = JSON.parse(capture(row, "value"));
    if (!Array.isArray(value)) {
      return [];
    }
    const [moduleId, , exportName]: unknown[] = value;
    if (!Predicate.isString(moduleId) || !Predicate.isString(exportName)) {
      return [];
    }
    const resolvedExport = exportName.startsWith(referencePrefix)
      ? (strings.get(exportName.slice(referencePrefixLength)) ?? exportName)
      : exportName;
    return [{ exportName: resolvedExport, moduleId }];
  });
};
