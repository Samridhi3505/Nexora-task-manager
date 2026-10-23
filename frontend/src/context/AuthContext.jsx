
import {
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react'

const AuthContext = createContext(null)

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser)

  const [token, setToken] = useState(
    () => localStorage.getItem('token')
  )

  // Restore authentication state when the app loads.
  useEffect(() => {
    if (!token || !user) {
      setUser(null)
      setToken(null)
      localStorage.removeItem('user')
      localStorage.removeItem('token')
    }
  }, []) // Run once on mount.

  function login(loginToken, loginUser) {
    if (!loginToken || !loginUser) {
      throw new Error('A token and user are required to log in.')
    }

    localStorage.setItem('token', loginToken)
    localStorage.setItem('user', JSON.stringify(loginUser))

    setToken(loginToken)
    setUser(loginUser)
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')

    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token && user),
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error(
      'useAuth must be used inside an AuthProvider.'
    )
  }

  return context
}
