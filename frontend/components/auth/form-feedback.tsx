import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FormFeedbackProps {
  error?: string | null;
  notice?: string | null;
}

export function FormFeedback({ error, notice }: FormFeedbackProps) {
  return (
    <div aria-live="polite" aria-atomic="true">
      {error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : notice ? (
        <Alert>
          <CircleCheck aria-hidden="true" />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
