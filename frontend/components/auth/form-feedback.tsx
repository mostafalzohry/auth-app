import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FormFeedbackProps {
  error?: string | null;
}

const FormFeedback = ({ error }: FormFeedbackProps) => {
  return (
    <div aria-live="polite" aria-atomic="true">
      {error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default FormFeedback;
