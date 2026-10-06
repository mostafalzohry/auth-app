"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { LoaderCircle } from "lucide-react";
import { FormFeedback } from "@/components/auth/form-feedback";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { signup } from "@/lib/auth-api";
import { authErrorMessage } from "@/lib/auth-errors";
import {
  signupSchema,
  type SignupFormValues,
} from "@/lib/validation/auth-schemas";

export function SignupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);

  const form = useForm<SignupFormValues>({
    resolver: yupResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    mode: "onTouched",
  });
  const pending = form.formState.isSubmitting || done;

  async function onSubmit(values: SignupFormValues) {
    if (inFlight.current) return;
    inFlight.current = true;
    setServerError(null);
    try {
      const { confirmPassword, ...payload } = values;
      void confirmPassword;
      await signup(payload);
      setDone(true);
      router.push("/signin?registered=1");
    } catch (error) {
      inFlight.current = false;
      setServerError(authErrorMessage(error, "signup"));
      if (error instanceof ApiError && error.status === 409) {
        form.setError("email", {
          type: "server",
          message: "This email is already registered.",
        });
      }
    }
  }

  return (
    <form
      onSubmit={(event) => form.handleSubmit(onSubmit)(event)}
      noValidate
      className="space-y-6"
    >
      <FormFeedback error={serverError} />
      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Name</FieldLabel>
              <Input
                {...field}
                id={field.name}
                autoComplete="name"
                aria-invalid={fieldState.invalid}
                aria-describedby={
                  fieldState.invalid ? `${field.name}-error` : undefined
                }
              />
              {fieldState.invalid && (
                <FieldError
                  id={`${field.name}-error`}
                  errors={[fieldState.error]}
                />
              )}
            </Field>
          )}
        />
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Email</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
                aria-describedby={
                  fieldState.invalid ? `${field.name}-error` : undefined
                }
              />
              {fieldState.invalid && (
                <FieldError
                  id={`${field.name}-error`}
                  errors={[fieldState.error]}
                />
              )}
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Password</FieldLabel>
              <PasswordInput
                {...field}
                onChange={(event) => {
                  field.onChange(event);
                  if (form.getValues("confirmPassword")) {
                    void form.trigger("confirmPassword");
                  }
                }}
                id={field.name}
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
                aria-describedby={`${field.name}-hint${fieldState.invalid ? ` ${field.name}-error` : ""}`}
              />
              <p
                id={`${field.name}-hint`}
                className="text-xs text-muted-foreground"
              >
                At least 8 characters with a letter, a number and a special
                character.
              </p>
              {fieldState.invalid && (
                <FieldError
                  id={`${field.name}-error`}
                  errors={[fieldState.error]}
                />
              )}
            </Field>
          )}
        />
        <Controller
          name="confirmPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Repeat password</FieldLabel>
              <PasswordInput
                {...field}
                id={field.name}
                toggleName="repeated password"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
                aria-describedby={
                  fieldState.invalid ? `${field.name}-error` : undefined
                }
              />
              {fieldState.invalid && (
                <FieldError
                  id={`${field.name}-error`}
                  errors={[fieldState.error]}
                />
              )}
            </Field>
          )}
        />
      </FieldGroup>
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={pending}
        aria-busy={pending}
      >
        {pending && (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        )}
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
