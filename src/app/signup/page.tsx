import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <Suspense fallback={<div className="skeleton h-80 w-full" />}>
        <AuthForm mode="signup" />
      </Suspense>
      <p className="mt-4 text-center text-[13px] text-stone-500">
        Already have an account?{" "}
        <a href="/login" className="focus-ring rounded font-medium text-indigo-600 hover:text-indigo-500">
          Log in
        </a>
      </p>
    </div>
  );
}
