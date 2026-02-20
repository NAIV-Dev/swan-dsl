import { parse } from "./src/index";

const EXAMPLE_DSL = `
app MyApp {
  entry Home
}

page Home {
  header "Welcome"
  button "Log in" -> Login
}

component LoginForm {
  field email
  field password

  submit "Continue" -> auth

  on auth {
    success -> Dashboard
    error -> LoginError
  }
}

page Login {
  header "Login"
  use LoginForm
}

page LoginError {
  text "Invalid credentials"
  button "Retry" -> Login
}

page Dashboard {
  header "Dashboard"
  text "Hello!"
  button "Logout" -> Home
}
`.trim();

async function main() {
  const program = parse(EXAMPLE_DSL);
  console.log("Parsed Program:\n" + JSON.stringify(program, null, 2));
}

// main().catch(console.error).finally(() => process.exit(0));
