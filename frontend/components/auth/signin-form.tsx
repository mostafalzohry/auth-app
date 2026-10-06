"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { LoaderCircle } from "lucide-react";
import FormFeedback from "@/components/auth/form-feedback";
import PasswordInput from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { signin } from "@/lib/auth-api";
import { authErrorMessage } from "@/lib/auth-errors";
import { clearCurrentUser, refreshCurrentUser } from "@/lib/current-user";
import {
  signinSchema,
  type SigninFormValues,
} from "@/lib/validation/auth-schemas";

const SigninForm = () => {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);

  const form = useForm<SigninFormValues>({
    resolver: yupResolver(signinSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });
  const pending = form.formState.isSubmitting || done;

  async function onSubmit(values: SigninFormValues) {
    if (inFlight.current) return;
    inFlight.current = true;
    setServerError(null);
    try {
      clearCurrentUser();
      await signin(values);
      try {
        await refreshCurrentUser();
      } catch (error) {
        throw error instanceof ApiError && error.status === 401
          ? new SessionNotStoredError()
          : error;
      }
      setDone(true);
      router.replace("/welcome");
    } catch (error) {
      inFlight.current = false;
      setServerError(
        error instanceof SessionNotStoredError
          ? "You are signed in, but your browser did not keep your session. Please allow cookies for this site and try again."
          : authErrorMessage(error, "signin"),
      );
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
                id={field.name}
                autoComplete="current-password"
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
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
};

export default SigninForm;

class SessionNotStoredError extends Error {}
