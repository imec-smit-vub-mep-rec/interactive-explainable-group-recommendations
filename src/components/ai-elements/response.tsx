"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";

type ResponseProps = ComponentProps<typeof Streamdown>;

const sanitizeSuggestionTags = (value: string) =>
  value
    // Remove complete suggestions blocks first.
    .replace(/<suggestions\b[^>]*>[\s\S]*?<\/suggestions\s*>/gi, "")
    // Remove any orphan opening/closing tags that may appear mid-stream.
    .replace(/<\/?suggestions\b[^>]*>/gi, "")
    // Remove a dangling unclosed block, if any.
    .replace(/<suggestions\b[^>]*>[\s\S]*$/gi, "");

export const Response = memo(
  ({ className, children, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      {...(typeof children === "string"
        ? { children: sanitizeSuggestionTags(children) }
        : { children })}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
