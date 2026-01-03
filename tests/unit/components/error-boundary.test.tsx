import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "../../utils/render";
import { RootErrorBoundary } from "@/components/error-boundaries/RootErrorBoundary";
import { ComponentErrorBoundary } from "@/components/error-boundaries/ComponentErrorBoundary";

// Component that throws an error
const BrokenComponent = () => {
  throw new Error("Test error");
};

// Working component
const WorkingComponent = () => <div>Working component</div>;

describe("RootErrorBoundary", () => {
  // Suppress console.error for error boundary tests
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when no error", () => {
    render(
      <RootErrorBoundary>
        <WorkingComponent />
      </RootErrorBoundary>
    );

    expect(screen.getByText("Working component")).toBeInTheDocument();
  });

  it("catches and displays errors", () => {
    render(
      <RootErrorBoundary>
        <BrokenComponent />
      </RootErrorBoundary>
    );

    expect(screen.getByText("Application Error")).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it("has a try again button", () => {
    render(
      <RootErrorBoundary>
        <BrokenComponent />
      </RootErrorBoundary>
    );

    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
  });

  it("has a home link", () => {
    render(
      <RootErrorBoundary>
        <BrokenComponent />
      </RootErrorBoundary>
    );

    expect(
      screen.getByRole("button", { name: /go home/i })
    ).toBeInTheDocument();
  });
});

describe("ComponentErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when no error", () => {
    render(
      <ComponentErrorBoundary>
        <WorkingComponent />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText("Working component")).toBeInTheDocument();
  });

  it("shows default error UI when error occurs", () => {
    render(
      <ComponentErrorBoundary>
        <BrokenComponent />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText("Component Error")).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ComponentErrorBoundary fallback={<div>Custom error message</div>}>
        <BrokenComponent />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText("Custom error message")).toBeInTheDocument();
  });

  it("calls onError callback when error occurs", () => {
    const onError = vi.fn();

    render(
      <ComponentErrorBoundary onError={onError}>
        <BrokenComponent />
      </ComponentErrorBoundary>
    );

    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it("has retry button", () => {
    render(
      <ComponentErrorBoundary>
        <BrokenComponent />
      </ComponentErrorBoundary>
    );

    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
