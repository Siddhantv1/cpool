// Lets Node's test runner load the app's files: they import each other without ".js" (Metro adds it, Node doesn't).
import { register } from "node:module";

const hook = `export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (specifier.startsWith(".") && !/\\.[cm]?js$/.test(specifier)) return next(specifier + ".js", context);
    throw error;
  }
}`;
register("data:text/javascript," + encodeURIComponent(hook));
