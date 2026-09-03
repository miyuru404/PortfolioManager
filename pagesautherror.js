import { useRouter } from "next/router"
import Link from "next/link"

export default function AuthError() {
  const router = useRouter()
  const { error } = router.query

  const errorMessages = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The verification link is invalid or has expired.",
    Default: "An error occurred during authentication.",
  }

  const errorMessage = errorMessages[error] || errorMessages.Default

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Authentication Error</h1>
        <p style={styles.message}>{errorMessage}</p>
        <Link href="/auth/signin" style={styles.link}>
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
    padding: "20px",
  },
  card: {
    backgroundColor: "white",
    padding: "40px",
    borderRadius: "8px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    width: "100%",
    maxWidth: "400px",
    textAlign: "center",
  },
  title: {
    color: "#c33",
    marginBottom: "20px",
  },
  message: {
    color: "#666",
    marginBottom: "30px",
  },
  link: {
    display: "inline-block",
    padding: "12px 24px",
    backgroundColor: "#0070f3",
    color: "white",
    borderRadius: "4px",
    textDecoration: "none",
  },
}
