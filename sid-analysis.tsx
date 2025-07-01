"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Eye, MousePointer, Type, Key, AlertCircle } from "lucide-react"

interface SidCommand {
  id: string
  label?: string
  command: string
  target: string
  value: string
  randomization?: string
}

interface SidAnalysisProps {
  commands: SidCommand[]
}

export function SidAnalysis({ commands }: SidAnalysisProps) {
  const getCommandIcon = (command: string) => {
    switch (command) {
      case "click":
        return <MousePointer className="w-4 h-4" />
      case "type":
        return <Type className="w-4 h-4" />
      case "password":
        return <Key className="w-4 h-4" />
      case "open":
        return <Eye className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  const getCommandColor = (command: string) => {
    switch (command) {
      case "click":
        return "bg-blue-100 text-blue-800"
      case "type":
        return "bg-green-100 text-green-800"
      case "password":
        return "bg-red-100 text-red-800"
      case "open":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const commandStats = commands.reduce(
    (acc, cmd) => {
      acc[cmd.command] = (acc[cmd.command] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const dataFields = commands.filter(
    (cmd) => cmd.label && cmd.value && (cmd.command === "type" || cmd.command === "password"),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          SID Command Analysis
        </CardTitle>
        <CardDescription>Analysis of commands and data fields from your Selenium IDE file</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Command Statistics */}
        <div>
          <h4 className="font-semibold mb-2">Command Statistics</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(commandStats).map(([command, count]) => (
              <Badge key={command} className={getCommandColor(command)}>
                {getCommandIcon(command)}
                <span className="ml-1">
                  {command}: {count}
                </span>
              </Badge>
            ))}
          </div>
        </div>

        {/* Data Fields */}
        {dataFields.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Data Input Fields ({dataFields.length})</h4>
            <div className="space-y-2">
              {dataFields.map((field, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    {getCommandIcon(field.command)}
                    <span className="font-medium">{field.label}</span>
                    <Badge variant="outline">{field.command}</Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    Value: <code className="bg-gray-200 px-1 rounded">{field.value}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Command Sequence */}
        <div>
          <h4 className="font-semibold mb-2">Command Sequence</h4>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {commands.map((cmd, index) => (
              <div key={index} className="flex items-center gap-2 text-sm p-1">
                <span className="text-gray-400 w-6">{index + 1}.</span>
                {getCommandIcon(cmd.command)}
                <span className="font-medium">{cmd.command}</span>
                {cmd.label && <span className="text-blue-600">({cmd.label})</span>}
                {cmd.value && <span className="text-gray-500 truncate max-w-32">= {cmd.value}</span>}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
