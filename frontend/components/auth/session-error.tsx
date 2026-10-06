import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface SessionErrorProps {
  message: string;
  onRetry: () => void;
}

const SessionError = ({ message, onRetry }: SessionErrorProps) => {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-4">
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
        <Button onClick={onRetry}>Try again</Button>
      </div>
    </main>
  );
};

export default SessionError;
