import { BookOpen, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { API_DOCS_URL } from "@/lib/brand";

const ApiDocsCard = () => {
  return (
    <Card className="min-w-0 border p-2 shadow-none ring-0 [--card-spacing:--spacing(6)]">
      <CardHeader>
        <BookOpen className="size-5 text-blue-700" aria-hidden="true" />
        <h2 className="text-lg font-semibold">API documentation</h2>
        <CardDescription>
          Explore the authentication endpoints in Swagger.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <a
          href={API_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-blue-700 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Open API documentation
          <span className="sr-only"> (opens in a new tab)</span>
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </CardContent>
    </Card>
  );
};

export default ApiDocsCard;
