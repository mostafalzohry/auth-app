import { BookOpen, ExternalLink } from "lucide-react";
import { API_DOCS_URL } from "@/lib/brand";

const ApiDocsCard = () => {
  return (
    <section
      aria-labelledby="api-docs"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-5 py-3 shadow-sm sm:px-6"
    >
      <div className="flex min-w-0 items-center gap-3">
        <BookOpen
          className="size-5 shrink-0 text-blue-700"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 id="api-docs" className="text-sm font-semibold">
            API documentation
          </h2>
          <p className="text-sm text-muted-foreground">
            Explore the endpoints in Swagger.
          </p>
        </div>
      </div>
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
    </section>
  );
};

export default ApiDocsCard;
