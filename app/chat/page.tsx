import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Chatbot from "@/components/gradely/chatbot"

export default function ChatPage() {
  return (
    <main className="container mx-auto max-w-4xl p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-balance">Gradely Chatbot</CardTitle>
        </CardHeader>
        <CardContent>
          <Chatbot />
        </CardContent>
      </Card>
    </main>
  )
}
