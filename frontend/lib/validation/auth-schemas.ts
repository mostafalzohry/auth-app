import * as yup from "yup";

const email = yup
  .string()
  .trim()
  .lowercase()
  .required("Email is required")
  .email("Enter a valid email address")
  .max(254, "Email must be at most 254 characters");

export const signupSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required("Name is required")
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name must be at most 100 characters"),
  email,
  password: yup
    .string()
    .required("Password is required")
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters")
    .matches(/\p{L}/u, "Password must contain at least one letter")
    .matches(/\p{N}/u, "Password must contain at least one number")
    .matches(
      /[^\p{L}\p{N}\s]/u,
      "Password must contain at least one special character",
    ),
});

export const signinSchema = yup.object({
  email,
  password: yup
    .string()
    .required("Password is required")
    .max(128, "Password must be at most 128 characters"),
});

export type SignupFormValues = yup.InferType<typeof signupSchema>;
export type SigninFormValues = yup.InferType<typeof signinSchema>;
