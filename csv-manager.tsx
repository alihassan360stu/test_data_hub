"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Download, FileSpreadsheet, Eye, Trash2 } from "lucide-react"

interface CsvFile {
  id: string
  name: string
  file: File
  data: string[][]
  headers: string[]
  rowCount: number
}

interface CsvManagerProps {
  onCsvSelect: (csvData: string[][], fileName: string) => void
}

export function CsvManager({ onCsvSelect }: CsvManagerProps) {
  const [csvFiles, setCsvFiles] = useState<CsvFile[]>([])
  const [selectedCsv, setSelectedCsv] = useState<CsvFile | null>(null)

  const parseCsvFile = async (file: File): Promise<string[][]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const lines = text.split("\n").filter((line) => line.trim())
          const data = lines.map((line) => {
            const values = []
            let current = ""
            let inQuotes = false

            for (let i = 0; i < line.length; i++) {
              const char = line[i]
              if (char === '"') {
                inQuotes = !inQuotes
              } else if (char === "," && !inQuotes) {
                values.push(current.trim().replace(/^"|"$/g, ""))
                current = ""
              } else {
                current += char
              }
            }
            values.push(current.trim().replace(/^"|"$/g, ""))
            return values
          })
          resolve(data)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = () => reject(new Error("Failed to read file"))
      reader.readAsText(file)
    })
  }

  const handleFileUpload = async (file: File) => {
    try {
      const data = await parseCsvFile(file)
      const csvFile: CsvFile = {
        id: Date.now().toString(),
        name: file.name,
        file,
        data,
        headers: data[0] || [],
        rowCount: data.length - 1,
      }
      setCsvFiles([...csvFiles, csvFile])
    } catch (error) {
      alert("Error parsing CSV file: " + error)
    }
  }

  const removeCsvFile = (id: string) => {
    setCsvFiles(csvFiles.filter((csv) => csv.id !== id))
    if (selectedCsv?.id === id) {
      setSelectedCsv(null)
    }
  }

  const generateSampleCsv = () => {
    const sampleData = [
      ["username", "email", "department", "role"],
      ["john.doe", "john.doe@company.com", "Engineering", "Developer"],
      ["jane.smith", "jane.smith@company.com", "Marketing", "Manager"],
      ["bob.wilson", "bob.wilson@company.com", "Sales", "Representative"],
      ["alice.brown", "alice.brown@company.com", "HR", "Coordinator"],
      ["charlie.davis", "charlie.davis@company.com", "Finance", "Analyst"],
    ]

    const csvContent = sampleData.map((row) => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "sample-lookup-data.csv"
    a.click()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            CSV Lookup Manager
          </CardTitle>
          <CardDescription>
            Upload CSV files to use as lookup data sources for your test data generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="csv-upload">Upload CSV File</Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleFileUpload(file)
                  }
                }}
              />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={generateSampleCsv}>
                <Download className="w-4 h-4 mr-2" />
                Sample CSV
              </Button>
            </div>
          </div>

          {csvFiles.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-3">Uploaded CSV Files</h4>
                <div className="grid gap-3">
                  {csvFiles.map((csv) => (
                    <div
                      key={csv.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedCsv?.id === csv.id ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
                      }`}
                      onClick={() => setSelectedCsv(csv)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet className="w-5 h-5 text-green-600" />
                          <div>
                            <div className="font-medium">{csv.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {csv.rowCount} rows, {csv.headers.length} columns
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onCsvSelect(csv.data, csv.name)
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Use
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeCsvFile(csv.id)
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {csv.headers.map((header, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {header}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {selectedCsv && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-3">Preview: {selectedCsv.name}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        {selectedCsv.headers.map((header, index) => (
                          <th key={index} className="border border-gray-300 px-3 py-2 text-left font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCsv.data.slice(1, 6).map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-gray-50">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="border border-gray-300 px-3 py-2">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {selectedCsv.rowCount > 5 && (
                    <p className="text-sm text-muted-foreground mt-2">... and {selectedCsv.rowCount - 5} more rows</p>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
