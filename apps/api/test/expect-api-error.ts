import { HttpException } from "@nestjs/common";
import { expect } from "vitest";

export async function expectApiError(
  promise: Promise<unknown>,
  expectedCode: string,
  expectedStatus: number,
) {
  try {
    await promise;
    throw new Error("Expected an API exception.");
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const exception = error as HttpException;
    expect(exception.getStatus()).toBe(expectedStatus);
    expect(exception.getResponse()).toMatchObject({ code: expectedCode });
  }
}
