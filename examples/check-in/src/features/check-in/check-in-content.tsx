import { queryAtom } from "@effront/core/query";
import { useAtom } from "@effect/atom-react";
import { Predicate } from "effect";
import { AsyncResult } from "effect/reactivity";
import type { JSX } from "react";
import { useActionState, useEffect } from "react";
import type { CheckInResult } from "./data.ts";
import { CheckInEvent } from "./event-preview.tsx";
import { checkInAttendee, previewCheckIn } from "./server.ts";

const previewAtom = queryAtom(previewCheckIn);
// oxlint-disable-next-line unicorn/no-null -- React's initial action state represents an unsubmitted form.
const noResult = null;
type ActionState = CheckInResult | typeof noResult;

const ticketCodeFrom = (formData: FormData): string => {
  const ticketCode = formData.get("ticketCode");
  return Predicate.isString(ticketCode) ? ticketCode : "";
};

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function CheckInContent(): JSX.Element {
  const [preview, queryPreview] = useAtom(previewAtom);
  const [result, submit, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const next = await checkInAttendee({ ticketCode: ticketCodeFrom(formData) });
      queryPreview([]);
      return next;
    },
    noResult,
  );

  useEffect(() => {
    queryPreview([]);
  }, [queryPreview]);

  if (AsyncResult.isInitial(preview)) {
    return <p data-testid="preview-state">Loading authorized event preview…</p>;
  }
  if (AsyncResult.isFailure(preview)) {
    return <p role="alert">The preview query failed.</p>;
  }
  if (Predicate.isNullish(preview.value)) {
    return <p role="alert">This organizer is not authorized to view this event.</p>;
  }

  return <CheckInEvent event={preview.value} pending={pending} result={result} submit={submit} />;
}
