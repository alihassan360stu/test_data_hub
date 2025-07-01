"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Trash2, Eye, Calendar, FileText, BarChart3, Search, Upload } from "lucide-react"
import { useState } from "react"
import { Database } from "lucide-react" // Import Database icon

interface StoredGeneration {
  id: string
  name: string
  createdAt: string
  dataCount: number
  positiveTests: number
  negativeTests: number
  fields: { name: string; type: string }[]
  data: any[]
  fieldConfigs: any[]
}

interface DataListViewProps {
  storedGenerations: StoredGeneration[]
  onDelete: (id: string) => void
  onDownload: (generation: StoredGeneration, format: "json" | "csv") => void
  onLoad: (generation: StoredGeneration) => void
}

export function DataListView({ storedGenerations, onDelete, onDownload, onLoad }: DataListViewProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedGeneration, setSelectedGeneration] = useState<StoredGeneration | null>(null)
  const [sortBy, setSortBy] = useState<"name" | "date" | "count">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  const filteredGenerations = storedGenerations
    .filter(
      (gen) =>
        gen.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gen.fields.some((field) => field.name.toLowerCase().includes(searchTerm.toLowerCase())),
    )
    .sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name)
          break
        case "date":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case "count":
          comparison = a.dataCount - b.dataCount
          break
      }
      return sortOrder === "asc" ? comparison : -comparison
    })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getTotalRecords = () => {
    return storedGenerations.reduce((sum, gen) => sum + gen.dataCount, 0)
  }

  const getTotalPositiveTests = () => {
    return storedGenerations.reduce((sum, gen) => sum + gen.positiveTests, 0)
  }

  const getTotalNegativeTests = () => {
    return storedGenerations.reduce((sum, gen) => sum + gen.negativeTests, 0)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Saved Test Data Generations</h1>
          <p className="text-muted-foreground mt-1">Manage and access your previously generated test data sets</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Generations</p>
                <p className="text-2xl font-bold text-blue-600">{storedGenerations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Records</p>
                <p className="text-2xl font-bold text-purple-600">{getTotalRecords().toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Positive Tests</p>
                <p className="text-2xl font-bold text-green-600">{getTotalPositiveTests().toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✗</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Negative Tests</p>
                <p className="text-2xl font-bold text-red-600">{getTotalNegativeTests().toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Generations</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="Search by name or field names..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <div>
                <Label>Sort By</Label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "name" | "date" | "count")}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="date">Date</option>
                  <option value="name">Name</option>
                  <option value="count">Record Count</option>
                </select>
              </div>

              <div>
                <Label>Order</Label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generations List */}
      {filteredGenerations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Database className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {storedGenerations.length === 0 ? "No Saved Generations" : "No Matching Generations"}
            </h3>
            <p className="text-gray-500">
              {storedGenerations.length === 0
                ? "Create your first test data generation to see it here."
                : "Try adjusting your search criteria."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredGenerations.map((generation) => (
            <Card key={generation.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-gray-800 mb-1">{generation.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 text-sm">
                      <Calendar className="w-4 h-4" />
                      {formatDate(generation.createdAt)}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(generation.id)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Statistics */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-lg font-bold text-gray-800">{generation.dataCount}</div>
                    <div className="text-xs text-gray-600">Total Records</div>
                  </div>
                  <div className="bg-green-50 p-2 rounded">
                    <div className="text-lg font-bold text-green-600">{generation.positiveTests}</div>
                    <div className="text-xs text-green-700">Positive</div>
                  </div>
                  <div className="bg-red-50 p-2 rounded">
                    <div className="text-lg font-bold text-red-600">{generation.negativeTests}</div>
                    <div className="text-xs text-red-700">Negative</div>
                  </div>
                </div>

                {/* Fields */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Fields ({generation.fields.length}):</p>
                  <div className="flex flex-wrap gap-1">
                    {generation.fields.slice(0, 4).map((field, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {field.name}
                      </Badge>
                    ))}
                    {generation.fields.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{generation.fields.length - 4} more
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => onLoad(generation)} className="flex-1">
                    <Upload className="w-4 h-4 mr-1" />
                    Load
                  </Button>

                  <Button variant="outline" size="sm" onClick={() => setSelectedGeneration(generation)}>
                    <Eye className="w-4 h-4" />
                  </Button>

                  <Button variant="outline" size="sm" onClick={() => onDownload(generation, "json")}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Generation Detail Modal */}
      {selectedGeneration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedGeneration.name}</CardTitle>
                  <CardDescription>Created: {formatDate(selectedGeneration.createdAt)}</CardDescription>
                </div>
                <Button variant="ghost" onClick={() => setSelectedGeneration(null)}>
                  ✕
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold">{selectedGeneration.dataCount}</div>
                  <div className="text-sm text-gray-600">Total Records</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded">
                  <div className="text-2xl font-bold text-green-600">{selectedGeneration.positiveTests}</div>
                  <div className="text-sm text-green-700">Positive Tests</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded">
                  <div className="text-2xl font-bold text-red-600">{selectedGeneration.negativeTests}</div>
                  <div className="text-sm text-red-700">Negative Tests</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded">
                  <div className="text-2xl font-bold text-blue-600">{selectedGeneration.fields.length}</div>
                  <div className="text-sm text-blue-700">Fields</div>
                </div>
              </div>

              {/* Fields Detail */}
              <div>
                <h4 className="font-semibold mb-2">Fields Configuration:</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {selectedGeneration.fields.map((field, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <Badge variant="outline" className="text-xs">
                        {field.type}
                      </Badge>
                      <span className="text-sm font-medium">{field.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Preview */}
              <div>
                <h4 className="font-semibold mb-2">Data Preview (First 5 records):</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-2 py-1 text-left">Test Type</th>
                        {selectedGeneration.fields.map((field, index) => (
                          <th key={index} className="border border-gray-300 px-2 py-1 text-left">
                            {field.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedGeneration.data.slice(0, 5).map((record, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-2 py-1">
                            <Badge
                              variant={record._testType?.startsWith("negative") ? "destructive" : "default"}
                              className="text-xs"
                            >
                              {record._testType}
                            </Badge>
                          </td>
                          {selectedGeneration.fields.map((field, fieldIndex) => (
                            <td key={fieldIndex} className="border border-gray-300 px-2 py-1">
                              {record[field.name] === null ? (
                                <span className="text-gray-400 italic">null</span>
                              ) : record[field.name] === "" ? (
                                <span className="text-gray-400 italic">empty</span>
                              ) : (
                                String(record[field.name])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {selectedGeneration.dataCount > 5 && (
                    <p className="text-sm text-gray-500 mt-2">
                      ... and {selectedGeneration.dataCount - 5} more records
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => {
                    onLoad(selectedGeneration)
                    setSelectedGeneration(null)
                  }}
                  className="flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Load in Generator
                </Button>

                <Button
                  variant="outline"
                  onClick={() => onDownload(selectedGeneration, "json")}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download JSON
                </Button>

                <Button
                  variant="outline"
                  onClick={() => onDownload(selectedGeneration, "csv")}
                  className="flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Download CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
