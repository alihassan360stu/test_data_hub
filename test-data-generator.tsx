"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import axios from "axios"
import {
  Upload,
  Download,
  Play,
  Plus,
  Trash2,
  FileText,
  Database,
  Settings,
  AlertTriangle,
  Sparkles,
  Copy,
} from "lucide-react"
import { SidAnalysis } from "./sid-analysis"

interface FieldConfig {
  id: string
  name: string
  type: "string" | "number" | "boolean" | "date" | "email" | "phone"
  dataType: "static" | "range" | "lookup" | "minmax" | "pattern"
  required: boolean
  maxFieldLength?: number
  generateNegativeTests?: boolean
  config: {
    staticValue?: string
    rangeMin?: number
    rangeMax?: number
    lookupValues?: string[]
    csvFile?: File
    csvData?: string[][]
    csvColumn?: string
    minLength?: number
    maxLength?: number
    pattern?: string
  }
}

interface SidCommand {
  id: string
  label?: string
  command: string
  target: string
  value: string
  randomization?: string
}

interface SidTest {
  id: string
  name: string
  commands: SidCommand[]
}

interface SidFile {
  id: string
  version: string
  name: string
  url: string
  tests: SidTest[]
}

interface StoredGeneration {
  id: string
  name: string
  createdAt: string
  dataCount: number
  positiveTests: number
  negativeTests: number
  fields: { name: string; type: string }[]
  data: any[]
  fieldConfigs: FieldConfig[]
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
export default function Component() {
  const [currentView, setCurrentView] = useState<"generator" | "datalist">("generator")
  const [storedGenerations, setStoredGenerations] = useState<StoredGeneration[]>([])
  const [sidFile, setSidFile] = useState<File | null>(null)
  const [parsedSidData, setParsedSidData] = useState<SidFile | null>(null)
  const [sidFields, setSidFields] = useState<FieldConfig[]>([])
  const [jsonSchema, setJsonSchema] = useState("")
  const [fields, setFields] = useState<FieldConfig[]>([])
  const [generatedData, setGeneratedData] = useState<any[]>([])
  const [recordCount, setRecordCount] = useState(10)
  const [includeNegativeTests, setIncludeNegativeTests] = useState(false)
  const [selectedTestType, setSelectedTestType] = useState<string | null>(null)
  const [filteredData, setFilteredData] = useState<any[]>([])
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; fieldId: string } | null>(null)
  const [editingValue, setEditingValue] = useState<string>("")
  const [generationName, setGenerationName] = useState("")
  const [aiPrompt, setAiPrompt] = useState("")

  const addField = () => {
    const newField: FieldConfig = {
      id: Date.now().toString(),
      name: "",
      type: "string",
      dataType: "static",
      required: false,
      config: {},
    }
    setFields([...fields, newField])
  }

  const updateField = (id: string, updates: Partial<FieldConfig>) => {
    setFields(fields.map((field) => (field.id === id ? { ...field, ...updates } : field)))
  }

  const removeField = (id: string) => {
    setFields(fields.filter((field) => field.id !== id))
  }

  const shouldAutoEnableNegativeTests = (field: FieldConfig): boolean => {
    // Auto-enable negative tests for validation-critical field types
    const autoEnableTypes = ["email", "phone", "date"]

    // Auto-enable for required fields
    if (field.required) return true

    // Auto-enable for fields with constraints
    if (field.maxFieldLength || field.config.rangeMin !== undefined || field.config.rangeMax !== undefined) {
      return true
    }

    // Auto-enable for validation-critical types
    if (autoEnableTypes.includes(field.type)) return true

    return false
  }

  const parseSidFile = async (file: File) => {
    try {
      const text = await file.text()
      const sidData: SidFile = JSON.parse(text)
      setParsedSidData(sidData)

      // Extract fields from commands
      const extractedFields: FieldConfig[] = []

      sidData.tests.forEach((test) => {
        test.commands.forEach((command) => {
          if (command.label && command.value && (command.command === "type" || command.command === "password")) {
            const fieldName = command.label.toLowerCase().replace(/\s+/g, "_")

            // Determine field type and data generation strategy
            let fieldType: FieldConfig["type"] = "string"
            let dataType: FieldConfig["dataType"] = "static"
            const config: FieldConfig["config"] = {}

            // Analyze the value to determine type and generation strategy
            if (command.command === "password") {
              fieldType = "string"
              dataType = "pattern"
              config.pattern = generatePasswordPattern(command.value)
            } else if (/^\d+$/.test(command.value)) {
              // Pure numeric - could be range or static
              fieldType = "number"
              if (command.value.length >= 6) {
                dataType = "range"
                const baseValue = Number.parseInt(command.value)
                config.rangeMin = Math.max(1, baseValue - 1000000)
                config.rangeMax = baseValue + 1000000
              } else {
                dataType = "static"
                config.staticValue = command.value
              }
            } else if (command.value.includes("@")) {
              fieldType = "email"
              dataType = "pattern"
              config.pattern = `{random}@${command.value.split("@")[1]}`
            } else if (/^\d{10,}$/.test(command.value.replace(/\D/g, ""))) {
              fieldType = "phone"
              dataType = "pattern"
              config.pattern = generatePhonePattern(command.value)
            } else {
              fieldType = "string"
              dataType = "minmax"
              config.minLength = Math.max(1, command.value.length - 2)
              config.maxLength = command.value.length + 2
            }

            // Check if field already exists
            const existingField = extractedFields.find((f) => f.name === fieldName)
            if (!existingField) {
              extractedFields.push({
                id: Date.now().toString() + Math.random(),
                name: fieldName,
                type: fieldType,
                dataType,
                required: true,
                config,
              })
            }
          }
        })
      })

      setSidFields(extractedFields)
      setFields(extractedFields)
    } catch (error) {
      console.error("Error parsing SID file:", error)
      alert("Error parsing SID file. Please check the file format.")
    }
  }

  const generatePasswordPattern = (password: string): string => {
    // Analyze password structure and create a pattern
    let pattern = ""
    for (let i = 0; i < password.length; i++) {
      const char = password[i]
      if (/[A-Z]/.test(char)) {
        pattern += "{UPPER}"
      } else if (/[a-z]/.test(char)) {
        pattern += "{lower}"
      } else if (/\d/.test(char)) {
        pattern += "{digit}"
      } else {
        pattern += char
      }
    }
    return pattern
  }

  const generatePhonePattern = (phone: string): string => {
    return phone.replace(/\d/g, "{digit}")
  }

  const parseCsvFile = async (file: File): Promise<string[][]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          if (!text) {
            reject(new Error("File is empty"))
            return
          }
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

  const handleCsvUpload = async (fieldId: string, file: File) => {
    try {
      const csvData = await parseCsvFile(file)
      updateField(fieldId, {
        config: {
          ...fields.find((f) => f.id === fieldId)?.config,
          csvFile: file,
          csvData: csvData,
        },
      })
    } catch (error) {
      console.error("CSV parsing error:", error)
      alert("Error parsing CSV file: " + (error instanceof Error ? error.message : "Unknown error"))
    }
  }

  const generateTestData = () => {
    const data = []

    // Check if any field has lookup values that should generate per-value records
    const lookupFields = fields.filter((f) => f.dataType === "lookup" && getLookupValues(f).length > 0)

    if (lookupFields.length > 0) {
      // Generate one record per lookup value
      const maxLookupValues = Math.max(...lookupFields.map((f) => getLookupValues(f).length))
      const actualRecordCount = Math.min(maxLookupValues, recordCount)

      for (let i = 0; i < actualRecordCount; i++) {
        const record: any = { _testType: "positive" }
        fields.forEach((field) => {
          if (!field.name) return // Skip fields without names

          if (field.dataType === "lookup") {
            const lookupValues = getLookupValues(field)
            if (lookupValues.length > 0) {
              // Use each lookup value in sequence, cycling if necessary
              record[field.name] = lookupValues[i % lookupValues.length]
            } else {
              record[field.name] = ""
            }
          } else {
            // Generate values for non-lookup fields
            record[field.name] = generateFieldValue(field, false)
          }
        })
        data.push(record)
      }
    } else {
      // Standard generation when no lookup fields
      for (let i = 0; i < recordCount; i++) {
        const record: any = { _testType: "positive" }
        fields.forEach((field) => {
          if (!field.name) return // Skip fields without names
          record[field.name] = generateFieldValue(field, false)
        })
        data.push(record)
      }
    }

    // Generate negative test cases - auto-include for critical fields
    const shouldIncludeNegativeTests = includeNegativeTests || fields.some((f) => shouldAutoEnableNegativeTests(f))

    if (shouldIncludeNegativeTests) {
      const negativeTestFields = fields.filter(
        (f) => (f.generateNegativeTests || shouldAutoEnableNegativeTests(f)) && f.name,
      )

      negativeTestFields.forEach((targetField) => {
        // Generate multiple negative test cases for each field
        const negativeTestTypes = getNegativeTestTypes(targetField)

        negativeTestTypes.forEach((testType) => {
          const negativeRecord: any = {
            _testType: `negative_${testType}`,
            _targetField: targetField.name,
            _autoSelected: shouldAutoEnableNegativeTests(targetField),
          }

          fields.forEach((field) => {
            if (!field.name) return

            if (field.id === targetField.id) {
              // Generate negative value for target field
              negativeRecord[field.name] = generateNegativeValue(field, testType)
            } else {
              // Generate valid values for other fields
              negativeRecord[field.name] = generateFieldValue(field, false)
            }
          })

          data.push(negativeRecord)
        })
      })
    }

    setGeneratedData(data)
    setFilteredData(data)
  }

  const getNegativeTestTypes = (field: FieldConfig): string[] => {
    const testTypes = []

    // Common negative tests for all field types
    if (field.required) {
      testTypes.push("empty", "null")
    }

    // Type-specific negative tests
    switch (field.type) {
      case "string":
        testTypes.push("too_long", "special_chars", "sql_injection")
        if (field.maxFieldLength) {
          testTypes.push("exceed_length")
        }
        break
      case "email":
        testTypes.push("invalid_format", "missing_at", "missing_domain")
        break
      case "phone":
        testTypes.push("invalid_format", "too_short", "too_long", "letters")
        break
      case "number":
        testTypes.push("string_value", "negative", "decimal", "overflow")
        if (field.config.rangeMin !== undefined) {
          testTypes.push("below_min")
        }
        if (field.config.rangeMax !== undefined) {
          testTypes.push("above_max")
        }
        break
      case "date":
        testTypes.push("invalid_format", "future_date", "past_date", "invalid_day")
        break
      case "boolean":
        testTypes.push("string_value", "number_value")
        break
    }

    return testTypes
  }

  const generateNegativeValue = (field: FieldConfig, testType: string): any => {
    switch (testType) {
      case "empty":
        return ""
      case "null":
        return null
      case "too_long":
        return "A".repeat(1000)
      case "exceed_length":
        return "A".repeat((field.maxFieldLength || 50) + 10)
      case "special_chars":
        return "!@#$%^&*()_+{}|:<>?[]\\;'\",./"
      case "sql_injection":
        return "'; DROP TABLE users; --"
      case "invalid_format":
        if (field.type === "email") return "invalid-email-format"
        if (field.type === "phone") return "abc-def-ghij"
        if (field.type === "date") return "2024-13-45"
        return "invalid_format"
      case "missing_at":
        return "emailwithoutatsign.com"
      case "missing_domain":
        return "email@"
      case "too_short":
        return "123"
      case "letters":
        return "abcdefghij"
      case "string_value":
        return "not_a_number"
      case "negative":
        return -999999
      case "decimal":
        return 123.456
      case "overflow":
        return 999999999999999999999
      case "below_min":
        return (field.config.rangeMin || 0) - 1
      case "above_max":
        return (field.config.rangeMax || 100) + 1
      case "future_date":
        return "2099-12-31"
      case "past_date":
        return "1900-01-01"
      case "invalid_day":
        return "2024-02-30"
      case "number_value":
        return 123
      default:
        return "invalid_test_value"
    }
  }

  const generateFieldValue = (field: FieldConfig, isNegative = false) => {
    if (!field.name) return ""

    let value: any

    switch (field.dataType) {
      case "static":
        value = field.config.staticValue || ""
        break
      case "range":
        const min = field.config.rangeMin || 0
        const max = field.config.rangeMax || 100
        value = Math.floor(Math.random() * (max - min + 1)) + min
        break
      case "lookup":
        const values = getLookupValues(field)
        if (values.length === 0) return ""
        value = values[Math.floor(Math.random() * values.length)]
        break
      case "minmax":
        const minLen = field.config.minLength || 1
        const maxLen = field.config.maxLength || 10
        const length = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen
        value = generateRandomString(length, field.type)
        break
      case "pattern":
        value = generateFromPattern(field.config.pattern || "", field.type)
        break
      default:
        value = generateRandomString(5, field.type)
    }

    // Apply field length limit if specified
    if (field.maxFieldLength && typeof value === "string") {
      value = value.substring(0, field.maxFieldLength)
    }

    return value
  }

  const generateRandomString = (length: number, type: string) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    let result = ""
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    switch (type) {
      case "email":
        return `${result.toLowerCase()}@example.com`
      case "phone":
        return `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`
      case "number":
        return Math.floor(Math.random() * 1000)
      case "boolean":
        return Math.random() > 0.5
      case "date":
        const randomDate = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
        return randomDate.toISOString().split("T")[0]
      default:
        return result
    }
  }

  const generateFromPattern = (pattern: string, fieldType: string) => {
    let result = pattern

    // Handle password patterns
    result = result.replace(/\{UPPER\}/g, () => String.fromCharCode(65 + Math.floor(Math.random() * 26)))
    result = result.replace(/\{lower\}/g, () => String.fromCharCode(97 + Math.floor(Math.random() * 26)))
    result = result.replace(/\{digit\}/g, () => Math.floor(Math.random() * 10).toString())

    // Handle generic random replacements
    result = result.replace(/\{random\}/g, () => Math.random().toString(36).substring(2, 8))

    // Handle field-specific patterns
    if (fieldType === "phone") {
      result = result.replace(/\{digit\}/g, () => Math.floor(Math.random() * 10).toString())
    }

    return result
  }

  const exportData = (format: "json" | "csv") => {
    const baseFileName = generationName
      ? generationName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
      : "test-data"

    if (format === "json") {
      const exportObject = {
        generationInfo: {
          name: generationName || "Unnamed Generation",
          createdAt: new Date().toISOString(),
          totalRecords: generatedData.length,
          positiveTests: generatedData.filter((r) => r._testType === "positive").length,
          negativeTests: generatedData.filter((r) => r._testType?.startsWith("negative")).length,
          fields: fields.filter((f) => f.name).map((f) => ({ name: f.name, type: f.type })),
        },
        data: generatedData,
      }
      const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${baseFileName}.json`
      a.click()
    } else {
      const headers = ["_testType", "_targetField", ...fields.map((f) => f.name)].join(",")
      const rows = generatedData
        .map((record) =>
          [record._testType || "", record._targetField || "", ...fields.map((f) => record[f.name] || "")].join(","),
        )
        .join("\n")
      const csv = `# Generation: ${generationName || "Unnamed Generation"}\n# Created: ${new Date().toISOString()}\n${headers}\n${rows}`
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${baseFileName}.csv`
      a.click()
    }
  }

  const getLookupValues = (field: FieldConfig): string[] => {
    // First check if CSV data is being used
    if (field.config.csvData && field.config.csvColumn) {
      const columnIndex = field.config.csvData[0].indexOf(field.config.csvColumn)
      if (columnIndex >= 0) {
        return field.config.csvData
          .slice(1)
          .map((row) => row[columnIndex] || "")
          .filter((v) => v.trim().length > 0)
      }
    }

    // Otherwise use manual lookup values
    return (field.config.lookupValues || []).filter((v) => v.trim().length > 0)
  }

  const startEditing = (rowIndex: number, fieldId: string, currentValue: any) => {
    setEditingCell({ rowIndex, fieldId })
    setEditingValue(String(currentValue || ""))
  }

  const saveEdit = () => {
    if (!editingCell) return

    const { rowIndex, fieldId } = editingCell
    const field = fields.find((f) => f.id === fieldId)
    if (!field) return

    const dataToUpdate = selectedTestType ? filteredData : generatedData
    const updatedData = [...dataToUpdate]

    // Convert value based on field type
    let convertedValue: any = editingValue
    switch (field.type) {
      case "number":
        convertedValue = Number(editingValue) || 0
        break
      case "boolean":
        convertedValue = editingValue.toLowerCase() === "true"
        break
      case "date":
        // Keep as string for date fields
        break
      default:
        // Keep as string
        break
    }

    updatedData[rowIndex][field.name] = convertedValue

    // Update both filtered and main data
    if (selectedTestType) {
      setFilteredData(updatedData)
      // Also update the main data
      const mainDataIndex = generatedData.findIndex(
        (item) => item === (selectedTestType ? filteredData : generatedData)[rowIndex],
      )
      if (mainDataIndex !== -1) {
        const newGeneratedData = [...generatedData]
        newGeneratedData[mainDataIndex][field.name] = convertedValue
        setGeneratedData(newGeneratedData)
      }
    } else {
      setGeneratedData(updatedData)
      setFilteredData(updatedData)
    }

    setEditingCell(null)
    setEditingValue("")
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setEditingValue("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEdit()
    } else if (e.key === "Escape") {
      cancelEdit()
    }
  }

  const saveGeneration = async() => {
    if (generatedData.length === 0) {
      alert("No data to save. Please generate data first.")
      return
    }

    const generation: StoredGeneration = {
      id: Date.now().toString(),
      name: generationName || `Generation ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      dataCount: generatedData.length,
      positiveTests: generatedData.filter((r) => r._testType === "positive").length,
      negativeTests: generatedData.filter((r) => r._testType?.startsWith("negative")).length,
      fields: fields.filter((f) => f.name).map((f) => ({ name: f.name, type: f.type })),
      data: generatedData,
      fieldConfigs: fields,
    }

    // const newStoredGenerations = [...storedGenerations, generation]
    // setStoredGenerations(newStoredGenerations)

    let response = await axios.post(`${apiUrl}/generator/create`,{data:JSON.stringify(generation)})
    if(response.data){
      loadStoredGenerations()
    }

    alert(`Generation "${generation.name}" saved successfully!`)
  }

  const loadStoredGenerations = async() => {
    try {      
      let data = await axios.get(`${apiUrl}/generator/`)
      if (data.data.status) {
        let temp:StoredGeneration[]=[] 

         data.data.data?.map((item:any)=>{
          console.log("temp     0",item)
          temp.push(JSON.parse(item.data))
         })
        setStoredGenerations([...temp])
      }
    } catch (error) {
      console.error("Error loading stored generations:", error)
    }
  }

  const deleteGeneration = async(id: string) => {
    if (confirm("Are you sure you want to delete this generation?")) {

      let responce =await axios.post(`${apiUrl}/generator/delete`,{id:id})
      if(responce?.data.status){
      const newStoredGenerations = storedGenerations.filter((g) => g.id !== id)
      setStoredGenerations(newStoredGenerations)
      }else{
      
      }
    }
  }

  const downloadGeneration = (generation: StoredGeneration, format: "json" | "csv") => {
    const baseFileName = generation.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")

    if (format === "json") {
      const exportObject = {
        generationInfo: {
          name: generation.name,
          createdAt: generation.createdAt,
          totalRecords: generation.dataCount,
          positiveTests: generation.positiveTests,
          negativeTests: generation.negativeTests,
          fields: generation.fields,
        },
        data: generation.data,
      }
      const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${baseFileName}.json`
      a.click()
    } else {
      const headers = ["_testType", "_targetField", ...generation.fields.map((f) => f.name)].join(",")
      const rows = generation.data
        .map((record) =>
          [
            record._testType || "",
            record._targetField || "",
            ...generation.fields.map((f) => record[f.name] || ""),
          ].join(","),
        )
        .join("\n")
      const csv = `# Generation: ${generation.name}\n# Created: ${generation.createdAt}\n${headers}\n${rows}`
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${baseFileName}.csv`
      a.click()
    }
  }

  const loadGeneration = (generation: StoredGeneration) => {
    setFields(generation.fieldConfigs)
    setGeneratedData(generation.data)
    setFilteredData(generation.data)
    setGenerationName(generation.name)
    setCurrentView("generator")
    alert(`Loaded generation "${generation.name}"`)
  }

  const generateAIPrompt = () => {
    if (!parsedSidData && fields.length === 0) {
      alert("Please upload a SID file or configure fields first.")
      return
    }

    let prompt = `
# ROLE: Test Data Generation Assistant

# GOAL:
Generate a structured JSON array of test data objects based on the provided Selenium test case context and detailed field configurations. The output must be a clean JSON array, ready for parsing and immediate use. Do not include any explanations, comments, or text outside of the final JSON array.

# CONTEXT: SELENIUM IDE TEST CASE
- **Test Suite Name:** ${parsedSidData?.name || "N/A"}
- **Target URL:** ${parsedSidData?.url || "N/A"}
- **User Flow Summary:** The test likely involves steps such as: ${
      parsedSidData?.tests[0]?.commands
        .map((c) => c.command)
        .slice(0, 5)
        .join(", ") || "opening a page, typing data, and clicking buttons"
    }.
- **Key Data Fields:** ${fields
      .map((f) => f.name)
      .filter(Boolean)
      .join(", ")}

# TASK:
Generate ${recordCount} positive test data records.
`

    const shouldGenerateNegativeTests = includeNegativeTests || fields.some((f) => shouldAutoEnableNegativeTests(f))

    if (shouldGenerateNegativeTests) {
      prompt += `Additionally, generate a comprehensive set of negative test cases for each field marked for negative testing. For each targeted field, create one or more records with invalid data for that field while keeping other fields valid.\n`
    }

    prompt += `
# FIELD CONFIGURATIONS & DATA GENERATION RULES:
`

    fields
      .filter((f) => f.name)
      .forEach((field) => {
        prompt += `
## Field: "${field.name}"
- **Type:** ${field.type}
- **Required:** ${field.required}
- **Generation Strategy:** ${field.dataType}
`
        switch (field.dataType) {
          case "static":
            prompt += `- **Value:** "${field.config.staticValue || ""}"\n`
            break
          case "range":
            prompt += `- **Min Value:** ${field.config.rangeMin}\n- **Max Value:** ${field.config.rangeMax}\n`
            break
          case "lookup":
            const lookupValues = getLookupValues(field)
            prompt += `- **Values:** [${lookupValues.map((v) => `"${v}"`).join(", ")}]\n- **Instruction:** For positive tests, pick one value from this list for each record. If generating one record per lookup value, cycle through the list.\n`
            break
          case "minmax":
            prompt += `- **Min Length:** ${field.config.minLength}\n- **Max Length:** ${field.config.maxLength}\n`
            break
          case "pattern":
            prompt += `- **Pattern:** "${field.config.pattern}"\n- **Instruction:** Generate a value that matches this pattern. Replace placeholders like {random}, {UPPER}, {lower}, {digit} with appropriate random values.\n`
            break
        }
        if (field.maxFieldLength) {
          prompt += `- **Constraint:** Maximum length is ${field.maxFieldLength} characters.\n`
        }
        if (shouldGenerateNegativeTests && (field.generateNegativeTests || shouldAutoEnableNegativeTests(field))) {
          prompt += `- **Negative Tests Required:** Generate various invalid inputs for this field. Examples:
- Empty or null values (if required is true)
- Invalid formats (e.g., for email, phone, date)
- Values violating length/range constraints
- Type mismatches (e.g., text in a number field)
- Common injection strings (e.g., "'; DROP TABLE users; --")
- Unicode and special characters\n`
        }
      })

    prompt += `
# OUTPUT STRUCTURE:
- The entire output must be a single, valid JSON array of objects.
- Each object represents one data record.
- Each object must contain these keys: ${fields
      .map((f) => `"${f.name}"`)
      .filter(Boolean)
      .join(", ")}.
- For negative test cases, add two extra keys to the object:
- **"_testType"**: A string describing the negative test (e.g., "negative_empty", "negative_invalid_email").
- **"_targetField"**: The name of the field being tested with invalid data.
- For positive test cases, set "_testType" to "positive" and "_targetField" to null or omit it.

# FINAL INSTRUCTION:
Proceed with generating the complete JSON array based on all the rules specified above.
`
    setAiPrompt(prompt.trim())
  }

  useEffect(() => {
    loadStoredGenerations()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Navigation */}
      <div className="w-64 bg-white shadow-lg border-r border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Test Data Hub</h2>
          <p className="text-sm text-gray-600 mt-1">Manage your test data</p>
        </div>

        <nav className="p-4 space-y-2">
          <button
            onClick={() => setCurrentView("generator")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
              currentView === "generator"
                ? "bg-blue-100 text-blue-800 border border-blue-200"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Settings className="w-5 h-5" />
            <div>
              <div className="font-medium">Data Generator</div>
              <div className="text-xs text-gray-500">Create new test data</div>
            </div>
          </button>

          <button
            onClick={() => setCurrentView("datalist")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
              currentView === "datalist"
                ? "bg-blue-100 text-blue-800 border border-blue-200"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Database className="w-5 h-5" />
            <div>
              <div className="font-medium">Data List</div>
              <div className="text-xs text-gray-500">View saved generations ({storedGenerations.length})</div>
            </div>
          </button>
        </nav>

        {currentView === "generator" && generatedData.length > 0 && (
          <div className="p-4 border-t border-gray-200">
            <Button onClick={saveGeneration} className="w-full flex items-center gap-2 bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4" />
              Save Generation
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {currentView === "datalist" ? (
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
                    <FileText className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Records</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {storedGenerations.reduce((sum, gen) => sum + gen.dataCount, 0).toLocaleString()}
                      </p>
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
                      <p className="text-2xl font-bold text-green-600">
                        {storedGenerations.reduce((sum, gen) => sum + gen.positiveTests, 0).toLocaleString()}
                      </p>
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
                      <p className="text-2xl font-bold text-red-600">
                        {storedGenerations.reduce((sum, gen) => sum + gen.negativeTests, 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Data Table */}
            <Card>
              <CardHeader>
                <CardTitle>Generations List</CardTitle>
                <CardDescription>All your saved test data generations</CardDescription>
              </CardHeader>
              <CardContent>
                {storedGenerations.length === 0 ? (
                  <div className="text-center py-8">
                    <Database className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">No Saved Generations</h3>
                    <p className="text-gray-500">Create your first test data generation to see it here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-700">Records</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-700">Positive</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-700">Negative</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Fields</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storedGenerations.map((generation) => (
                          <tr key={generation.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div>
                                <div className="font-medium text-gray-900">{generation.name}</div>
                                <div className="text-sm text-gray-500">ID: {generation.id}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {new Date(generation.createdAt).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge variant="secondary">{generation.dataCount}</Badge>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                {generation.positiveTests}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge variant="destructive">{generation.negativeTests}</Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {generation.fields.slice(0, 3).map((field, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {field.name}
                                  </Badge>
                                ))}
                                {generation.fields.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{generation.fields.length - 3}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => loadGeneration(generation)}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  Load
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => downloadGeneration(generation, "json")}
                                  className="text-green-600 hover:text-green-800"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => downloadGeneration(generation, "csv")}
                                  className="text-purple-600 hover:text-purple-800"
                                >
                                  CSV
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deleteGeneration(generation.id)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          // Existing generator content wrapped in a container
          <div className="p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Automated Test Data Generator</h1>
              </div>

              {/* Rest of the existing generator content goes here */}
              {/* Keep all the existing Tabs component and its content */}
              <Tabs defaultValue="setup" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="setup" className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Setup
                  </TabsTrigger>
                  <TabsTrigger value="schema" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Schema
                  </TabsTrigger>
                  <TabsTrigger value="fields" className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Fields
                  </TabsTrigger>
                  <TabsTrigger value="generate" className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Generate
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="setup" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>File Upload</CardTitle>
                      <CardDescription>Upload your Selenium SID file to extract test configuration</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <div className="space-y-2">
                          <p className="text-lg font-medium">Upload Selenium SID File</p>
                          <p className="text-sm text-muted-foreground">
                            Drag and drop your .sid file here or click to browse
                          </p>
                          <Input
                            type="file"
                            accept=".sid,.json"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                setSidFile(file)
                                parseSidFile(file)
                              }
                            }}
                            className="max-w-xs mx-auto"
                          />
                        </div>
                      </div>
                      {sidFile && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                          <FileText className="w-5 h-5 text-green-600" />
                          <span className="text-sm font-medium">Uploaded: {sidFile.name}</span>
                          <Badge variant="secondary">{(sidFile.size / 1024).toFixed(1)} KB</Badge>
                        </div>
                      )}

                      <Card className="border-2 border-blue-200 bg-blue-50">
                        <CardHeader>
                          <CardTitle className="text-blue-900">Test Data Generation Name</CardTitle>
                          <CardDescription className="text-blue-700">
                            Give your test data generation a descriptive name for easy identification
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="generationName" className="text-blue-900 font-medium">
                              Generation Name
                            </Label>
                            <Input
                              id="generationName"
                              value={generationName}
                              onChange={(e) => setGenerationName(e.target.value)}
                              placeholder="e.g., User Registration Test Data, Login Validation Tests, etc."
                              className="border-blue-300 focus:border-blue-500"
                            />
                          </div>
                          {generationName && (
                            <div className="p-3 bg-white rounded-lg border border-blue-200">
                              <p className="text-sm font-medium text-blue-800">Current Generation:</p>
                              <p className="text-blue-700 font-semibold">{generationName}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {parsedSidData && (
                        <div className="space-y-4">
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <h3 className="font-semibold text-blue-900 mb-2">SID File Information</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Test Name:</span> {parsedSidData.name}
                              </div>
                              <div>
                                <span className="font-medium">Version:</span> {parsedSidData.version}
                              </div>
                              <div>
                                <span className="font-medium">Tests:</span> {parsedSidData.tests.length}
                              </div>
                              <div>
                                <span className="font-medium">URL:</span>
                                <a
                                  href={parsedSidData.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline ml-1"
                                >
                                  {parsedSidData.url.substring(0, 50)}...
                                </a>
                              </div>
                            </div>
                          </div>

                          {parsedSidData && parsedSidData.tests.length > 0 && (
                            <SidAnalysis commands={parsedSidData.tests[0].commands} />
                          )}

                          {sidFields.length > 0 && (
                            <div className="bg-green-50 p-4 rounded-lg">
                              <h4 className="font-semibold text-green-900 mb-2">
                                Extracted Fields ({sidFields.length})
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {sidFields.map((field) => (
                                  <Badge key={field.id} variant="secondary">
                                    {field.name} ({field.type})
                                  </Badge>
                                ))}
                              </div>
                              <p className="text-sm text-green-700 mt-2">
                                Fields have been automatically configured based on your SID file. You can modify them in
                                the Fields tab.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="schema" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>JSON Schema Configuration</CardTitle>
                      <CardDescription>Define your API JSON schema for data structure validation</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="schema">JSON Schema</Label>
                        <Textarea
                          id="schema"
                          placeholder={`{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "number" },
    "email": { "type": "string", "format": "email" }
  },
  "required": ["name", "email"]
}`}
                          value={jsonSchema}
                          onChange={(e) => setJsonSchema(e.target.value)}
                          className="min-h-[200px] font-mono text-sm"
                        />
                      </div>
                      <Button
                        onClick={() => {
                          try {
                            const schema = JSON.parse(jsonSchema)
                            // Auto-generate fields from schema
                            const newFields = Object.entries(schema.properties || {}).map(
                              ([key, prop]: [string, any]) => ({
                                id: Date.now().toString() + Math.random(),
                                name: key,
                                type: prop.type === "integer" ? "number" : prop.type,
                                dataType: "static" as const,
                                required: schema.required?.includes(key) || false,
                                config: {},
                              }),
                            )
                            setFields(newFields)
                          } catch (e) {
                            alert("Invalid JSON schema")
                          }
                        }}
                      >
                        Generate Fields from Schema
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="fields" className="space-y-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>Field Configuration</CardTitle>
                        <CardDescription>Configure data generation rules for each field</CardDescription>
                      </div>
                      <Button onClick={addField} className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Field
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {fields.map((field, index) => (
                        <Card key={field.id} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div className="space-y-2">
                              <Label>Field Name</Label>
                              <Input
                                value={field.name}
                                onChange={(e) => updateField(field.id, { name: e.target.value })}
                                placeholder="Field name"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Data Type</Label>
                              <Select
                                value={field.type}
                                onValueChange={(value: any) => updateField(field.id, { type: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="string">String</SelectItem>
                                  <SelectItem value="number">Number</SelectItem>
                                  <SelectItem value="boolean">Boolean</SelectItem>
                                  <SelectItem value="date">Date</SelectItem>
                                  <SelectItem value="email">Email</SelectItem>
                                  <SelectItem value="phone">Phone</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Max Field Length</Label>
                              <Input
                                type="number"
                                value={field.maxFieldLength || ""}
                                onChange={(e) =>
                                  updateField(field.id, {
                                    maxFieldLength: Number.parseInt(e.target.value) || undefined,
                                  })
                                }
                                placeholder="Max length (optional)"
                                min="1"
                                max="1000"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Generation Type</Label>
                              <Select
                                value={field.dataType}
                                onValueChange={(value: any) => updateField(field.id, { dataType: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="static">Static Value</SelectItem>
                                  <SelectItem value="range">Range Values</SelectItem>
                                  <SelectItem value="lookup">Lookup Values</SelectItem>
                                  <SelectItem value="minmax">Min/Max Length</SelectItem>
                                  <SelectItem value="pattern">Pattern</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex items-end gap-2">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`negativeTests-${field.id}`}
                                  checked={field.generateNegativeTests || shouldAutoEnableNegativeTests(field)}
                                  onChange={(e) => updateField(field.id, { generateNegativeTests: e.target.checked })}
                                />
                                <Label htmlFor={`negativeTests-${field.id}`} className="text-xs">
                                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                                  Negative Tests
                                  {shouldAutoEnableNegativeTests(field) && (
                                    <Badge variant="secondary" className="ml-1 text-xs">
                                      Auto
                                    </Badge>
                                  )}
                                </Label>
                              </div>
                              <Button variant="destructive" size="icon" onClick={() => removeField(field.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <Separator className="my-4" />

                          {/* Dynamic configuration based on dataType */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {field.dataType === "static" && (
                              <div className="space-y-2">
                                <Label>Static Value</Label>
                                <Input
                                  value={field.config.staticValue || ""}
                                  onChange={(e) =>
                                    updateField(field.id, {
                                      config: { ...field.config, staticValue: e.target.value },
                                    })
                                  }
                                  placeholder="Enter static value"
                                />
                              </div>
                            )}

                            {field.dataType === "range" && (
                              <>
                                <div className="space-y-2">
                                  <Label>Min Value</Label>
                                  <Input
                                    type="number"
                                    value={field.config.rangeMin || ""}
                                    onChange={(e) =>
                                      updateField(field.id, {
                                        config: { ...field.config, rangeMin: Number.parseInt(e.target.value) },
                                      })
                                    }
                                    placeholder="Minimum value"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Max Value</Label>
                                  <Input
                                    type="number"
                                    value={field.config.rangeMax || ""}
                                    onChange={(e) =>
                                      updateField(field.id, {
                                        config: { ...field.config, rangeMax: Number.parseInt(e.target.value) },
                                      })
                                    }
                                    placeholder="Maximum value"
                                  />
                                </div>
                              </>
                            )}

                            {field.dataType === "lookup" && (
                              <div className="space-y-4 md:col-span-2">
                                <div className="space-y-3">
                                  <Label>Lookup Data Source</Label>

                                  {/* Option 1: Text Input */}
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">Option 1: Manual Entry</Label>
                                    <Textarea
                                      value={field.config.lookupValues?.join(", ") || ""}
                                      onChange={(e) => {
                                        const inputValue = e.target.value
                                        const values = inputValue
                                          .split(",")
                                          .map((v) => v.trim())
                                          .filter((v) => v.length > 0) // Remove empty strings

                                        updateField(field.id, {
                                          config: {
                                            ...field.config,
                                            lookupValues: values,
                                            // Clear CSV data when manual entry is used
                                            csvFile: undefined,
                                            csvData: undefined,
                                            csvColumn: undefined,
                                          },
                                        })
                                      }}
                                      placeholder="value1, value2, value3"
                                      rows={3}
                                    />
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 border-t border-gray-300"></div>
                                    <span className="text-sm text-gray-500">OR</span>
                                    <div className="flex-1 border-t border-gray-300"></div>
                                  </div>

                                  {/* Option 2: CSV Upload */}
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">Option 2: CSV Upload</Label>
                                    <Input
                                      type="file"
                                      accept=".csv"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                          handleCsvUpload(field.id, file)
                                        }
                                      }}
                                    />
                                    {field.config.csvFile && (
                                      <div className="text-sm text-green-600">
                                        Uploaded: {field.config.csvFile.name} ({field.config.csvData?.length || 0} rows)
                                      </div>
                                    )}
                                  </div>

                                  {field.config.csvData && field.config.csvData.length > 0 && (
                                    <div className="space-y-2">
                                      <Label>Select Column for Lookup Values</Label>
                                      <Select
                                        value={field.config.csvColumn || ""}
                                        onValueChange={(value) =>
                                          updateField(field.id, {
                                            config: {
                                              ...field.config,
                                              csvColumn: value,
                                              lookupValues: undefined, // Clear manual values when CSV is used
                                            },
                                          })
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select column" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {field.config.csvData[0].map((header, index) => (
                                            <SelectItem key={index} value={header}>
                                              {header}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}

                                  {/* Show current lookup values */}
                                  {(field.config.lookupValues?.length > 0 ||
                                    (field.config.csvData && field.config.csvColumn)) && (
                                    <div className="bg-blue-50 p-3 rounded-lg">
                                      <p className="text-sm font-medium text-blue-900 mb-2">
                                        Current Lookup Values ({getLookupValues(field).length} values):
                                      </p>
                                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                        {getLookupValues(field)
                                          .slice(0, 10)
                                          .map((value, index) => (
                                            <Badge key={index} variant="secondary" className="text-xs">
                                              {value}
                                            </Badge>
                                          ))}
                                        {getLookupValues(field).length > 10 && (
                                          <Badge variant="outline" className="text-xs">
                                            +{getLookupValues(field).length - 10} more
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-blue-700 mt-2">
                                        ✨ Test data will be generated for each lookup value (one record per value)
                                      </p>
                                    </div>
                                  )}

                                  {field.config.csvData && field.config.csvData.length > 0 && (
                                    <div className="bg-gray-50 p-3 rounded-lg">
                                      <p className="text-sm font-medium mb-2">CSV Preview:</p>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-xs border-collapse border border-gray-300">
                                          <thead>
                                            <tr className="bg-gray-100">
                                              {field.config.csvData[0].map((header, index) => (
                                                <th key={index} className="border border-gray-300 px-2 py-1 text-left">
                                                  {header}
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {field.config.csvData.slice(1, 4).map((row, rowIndex) => (
                                              <tr key={rowIndex}>
                                                {row.map((cell, cellIndex) => (
                                                  <td key={cellIndex} className="border border-gray-300 px-2 py-1">
                                                    {cell}
                                                  </td>
                                                ))}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                        {field.config.csvData.length > 4 && (
                                          <p className="text-xs text-gray-500 mt-1">
                                            ... and {field.config.csvData.length - 4} more rows
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {field.dataType === "minmax" && (
                              <>
                                <div className="space-y-2">
                                  <Label>Min Length</Label>
                                  <Input
                                    type="number"
                                    value={field.config.minLength || ""}
                                    onChange={(e) =>
                                      updateField(field.id, {
                                        config: { ...field.config, minLength: Number.parseInt(e.target.value) },
                                      })
                                    }
                                    placeholder="Minimum length"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Max Length</Label>
                                  <Input
                                    type="number"
                                    value={field.config.maxLength || ""}
                                    onChange={(e) =>
                                      updateField(field.id, {
                                        config: { ...field.config, maxLength: Number.parseInt(e.target.value) },
                                      })
                                    }
                                    placeholder="Maximum length"
                                  />
                                </div>
                              </>
                            )}

                            {field.dataType === "pattern" && (
                              <div className="space-y-2 md:col-span-2">
                                <Label>Pattern (use {"{random}"} for random values)</Label>
                                <Input
                                  value={field.config.pattern || ""}
                                  onChange={(e) =>
                                    updateField(field.id, {
                                      config: { ...field.config, pattern: e.target.value },
                                    })
                                  }
                                  placeholder="USER_{random}_2024"
                                />
                              </div>
                            )}
                          </div>

                          {field.generateNegativeTests && (
                            <div className="mt-4 p-3 bg-orange-50 rounded-lg">
                              <p className="text-sm font-medium text-orange-800 mb-2">
                                <AlertTriangle className="w-4 h-4 inline mr-1" />
                                Negative Test Cases Enabled
                              </p>
                              <p className="text-xs text-orange-700">
                                This field will generate negative test cases including: empty values, invalid formats,
                                boundary violations, and type mismatches based on the field type and constraints.
                              </p>
                            </div>
                          )}
                        </Card>
                      ))}

                      {fields.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No fields configured yet. Add fields to start generating test data.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="generate" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-1">
                      <CardHeader>
                        <CardTitle>Generation Settings</CardTitle>
                        <CardDescription>Configure data generation parameters</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Number of Records</Label>
                          <Input
                            type="number"
                            value={recordCount}
                            onChange={(e) => setRecordCount(Number.parseInt(e.target.value) || 10)}
                            min="1"
                            max="10000"
                          />
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="includeNegativeTests"
                              checked={includeNegativeTests}
                              onChange={(e) => setIncludeNegativeTests(e.target.checked)}
                            />
                            <Label htmlFor="includeNegativeTests" className="text-sm">
                              <AlertTriangle className="w-4 h-4 inline mr-1 text-orange-500" />
                              Include Additional Negative Tests
                            </Label>
                          </div>

                          {/* Show auto-selected fields */}
                          {fields.filter((f) => shouldAutoEnableNegativeTests(f)).length > 0 && (
                            <div className="bg-blue-50 p-3 rounded-lg">
                              <p className="text-xs font-medium text-blue-800 mb-2">
                                Auto-Selected for Negative Testing:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {fields
                                  .filter((f) => shouldAutoEnableNegativeTests(f) && f.name)
                                  .map((field) => (
                                    <Badge key={field.id} variant="secondary" className="text-xs">
                                      {field.name}
                                      {field.required && <span className="ml-1 text-red-500">*</span>}
                                    </Badge>
                                  ))}
                              </div>
                              <p className="text-xs text-blue-700 mt-2">
                                These fields are automatically selected based on validation requirements, constraints,
                                or field types.
                              </p>
                            </div>
                          )}

                          {(includeNegativeTests || fields.some((f) => shouldAutoEnableNegativeTests(f))) && (
                            <div className="bg-orange-50 p-3 rounded-lg">
                              <p className="text-xs text-orange-700">
                                Negative tests will be generated for{" "}
                                {
                                  fields.filter((f) => f.generateNegativeTests || shouldAutoEnableNegativeTests(f))
                                    .length
                                }{" "}
                                fields. These include invalid data to test validation and error handling.
                              </p>
                            </div>
                          )}
                        </div>

                        <Button onClick={generateTestData} className="w-full flex items-center gap-2">
                          <Play className="w-4 h-4" />
                          Generate Test Data
                        </Button>

                        <Button
                          onClick={generateAIPrompt}
                          variant="outline"
                          className="w-full flex items-center gap-2 bg-transparent"
                        >
                          <Sparkles className="w-4 h-4" />
                          Generate AI Prompt
                        </Button>

                        {generatedData.length > 0 && (
                          <div className="space-y-2">
                            <Separator />
                            <p className="text-sm font-medium">Export Options</p>
                            <div className="flex gap-2">
                              <Button variant="outline" onClick={() => exportData("json")} className="flex-1">
                                <Download className="w-4 h-4 mr-2" />
                                JSON
                              </Button>
                              <Button variant="outline" onClick={() => exportData("csv")} className="flex-1">
                                <Download className="w-4 h-4 mr-2" />
                                CSV
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {aiPrompt && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-purple-500" />
                            Generated AI Prompt
                          </CardTitle>
                          <CardDescription>
                            Copy this prompt and paste it into your preferred AI model (e.g., ChatGPT, Claude, Llama) to
                            get your test data.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <Textarea
                            readOnly
                            value={aiPrompt}
                            className="min-h-[300px] font-mono text-sm bg-gray-50"
                            aria-label="Generated AI Prompt"
                          />
                          <Button
                            onClick={() => {
                              navigator.clipboard.writeText(aiPrompt)
                              alert("Prompt copied to clipboard!")
                            }}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Prompt
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          Generated Data Preview
                          {generationName && (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800">
                              {generationName}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {generatedData.length > 0
                            ? `Showing ${Math.min(5, generatedData.length)} of ${generatedData.length} records`
                            : "No data generated yet"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {generatedData.length > 0 && (
                          <div className="bg-gray-50 p-4 rounded-lg mb-4">
                            {generationName && (
                              <div className="mb-3 p-2 bg-white rounded border-l-4 border-l-blue-500">
                                <p className="text-sm font-medium text-blue-800">📋 Generation: {generationName}</p>
                                <p className="text-xs text-blue-600">Created: {new Date().toLocaleString()}</p>
                              </div>
                            )}
                            <p className="text-sm font-medium mb-3">Interactive Test Data Summary:</p>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                              <div
                                className={`p-3 rounded cursor-pointer transition-all hover:shadow-md ${
                                  selectedTestType === "positive"
                                    ? "bg-green-200 border-2 border-green-500 shadow-md"
                                    : "bg-green-100 hover:bg-green-150"
                                }`}
                                onClick={() => {
                                  const positiveData = generatedData.filter((r) => r._testType === "positive")
                                  setSelectedTestType(selectedTestType === "positive" ? null : "positive")
                                  setFilteredData(selectedTestType === "positive" ? generatedData : positiveData)
                                }}
                              >
                                <div className="font-medium text-green-800">✅ Positive Tests</div>
                                <div className="text-green-600 text-lg font-bold">
                                  {generatedData.filter((r) => r._testType === "positive").length}
                                </div>
                                <div className="text-green-700 text-xs mt-1">Click to view</div>
                              </div>

                              <div
                                className={`p-3 rounded cursor-pointer transition-all hover:shadow-md ${
                                  selectedTestType === "negative"
                                    ? "bg-orange-200 border-2 border-orange-500 shadow-md"
                                    : "bg-orange-100 hover:bg-orange-150"
                                }`}
                                onClick={() => {
                                  const negativeData = generatedData.filter((r) => r._testType?.startsWith("negative"))
                                  setSelectedTestType(selectedTestType === "negative" ? null : "negative")
                                  setFilteredData(selectedTestType === "negative" ? generatedData : negativeData)
                                }}
                              >
                                <div className="font-medium text-orange-800">❌ Negative Tests</div>
                                <div className="text-orange-600 text-lg font-bold">
                                  {generatedData.filter((r) => r._testType?.startsWith("negative")).length}
                                </div>
                                <div className="text-orange-700 text-xs mt-1">Click to view</div>
                              </div>

                              <div
                                className={`p-3 rounded cursor-pointer transition-all hover:shadow-md ${
                                  selectedTestType === "auto"
                                    ? "bg-blue-200 border-2 border-blue-500 shadow-md"
                                    : "bg-blue-100 hover:bg-blue-150"
                                }`}
                                onClick={() => {
                                  const autoData = generatedData.filter((r) => r._autoSelected)
                                  setSelectedTestType(selectedTestType === "auto" ? null : "auto")
                                  setFilteredData(selectedTestType === "auto" ? generatedData : autoData)
                                }}
                              >
                                <div className="font-medium text-blue-800">🤖 Auto-Selected</div>
                                <div className="text-blue-600 text-lg font-bold">
                                  {generatedData.filter((r) => r._autoSelected).length}
                                </div>
                                <div className="text-blue-700 text-xs mt-1">Click to view</div>
                              </div>

                              <div className="bg-purple-100 p-3 rounded">
                                <div className="font-medium text-purple-800">📊 Total Records</div>
                                <div className="text-purple-600 text-lg font-bold">{generatedData.length}</div>
                              </div>

                              <div className="bg-gray-100 p-3 rounded">
                                <div className="font-medium text-gray-800">🏷️ Fields</div>
                                <div className="text-gray-600 text-lg font-bold">
                                  {fields.filter((f) => f.name).length}
                                </div>
                              </div>
                            </div>

                            {selectedTestType && (
                              <div className="mt-4 p-3 bg-white rounded-lg border-2 border-dashed border-gray-300">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-sm font-medium">
                                    Showing{" "}
                                    {selectedTestType === "positive"
                                      ? "✅ Positive"
                                      : selectedTestType === "negative"
                                        ? "❌ Negative"
                                        : "🤖 Auto-Selected"}{" "}
                                    Test Cases ({filteredData.length} records)
                                  </p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedTestType(null)
                                      setFilteredData(generatedData)
                                    }}
                                  >
                                    Show All
                                  </Button>
                                </div>

                                {selectedTestType === "negative" && (
                                  <div className="mb-3">
                                    <p className="text-xs font-medium text-gray-700 mb-2">
                                      Target Fields Being Tested:
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {[...new Set(filteredData.map((r) => r._targetField).filter(Boolean))].map(
                                        (targetField, index) => (
                                          <Badge key={index} variant="destructive" className="text-xs">
                                            {targetField}
                                          </Badge>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {generatedData.length > 0 ? (
                          <div className="space-y-4">
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse border border-gray-300">
                                <thead>
                                  <tr className="bg-gray-50">
                                    <th className="border border-gray-300 px-4 py-2 text-left font-medium">
                                      Test Type
                                    </th>
                                    <th className="border border-gray-300 px-4 py-2 text-left font-medium">
                                      Target Field
                                    </th>
                                    {fields.map((field) => (
                                      <th
                                        key={field.id}
                                        className="border border-gray-300 px-4 py-2 text-left font-medium"
                                      >
                                        {field.name}
                                        {selectedTestType === "negative" &&
                                          filteredData.some((r) => r._targetField === field.name) && (
                                            <span className="ml-1 text-red-500">🎯</span>
                                          )}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(selectedTestType ? filteredData : generatedData)
                                    .slice(0, 10)
                                    .map((record, index) => (
                                      <tr
                                        key={index}
                                        className={`hover:bg-gray-50 transition-colors ${
                                          record._testType?.startsWith("negative") ? "bg-red-50" : ""
                                        } ${
                                          selectedTestType === "negative" && record._targetField
                                            ? "border-l-4 border-l-red-400"
                                            : ""
                                        }`}
                                      >
                                        <td className="border border-gray-300 px-4 py-2 text-sm">
                                          <Badge
                                            variant={
                                              record._testType?.startsWith("negative") ? "destructive" : "default"
                                            }
                                          >
                                            {record._testType}
                                            {record._autoSelected && <span className="ml-1">🤖</span>}
                                          </Badge>
                                        </td>
                                        <td className="border border-gray-300 px-4 py-2 text-sm">
                                          {record._targetField ? (
                                            <Badge variant="outline" className="bg-yellow-100">
                                              🎯 {record._targetField}
                                            </Badge>
                                          ) : (
                                            "-"
                                          )}
                                        </td>
                                        {fields.map((field) => {
                                          const isEditing =
                                            editingCell?.rowIndex === index && editingCell?.fieldId === field.id
                                          const cellValue = record[field.name]
                                          const isTargetField =
                                            selectedTestType === "negative" && record._targetField === field.name

                                          return (
                                            <td
                                              key={field.id}
                                              className={`border border-gray-300 px-2 py-2 text-sm relative group ${
                                                isTargetField ? "bg-red-100" : ""
                                              } ${isEditing ? "bg-blue-50" : ""}`}
                                            >
                                              {isEditing ? (
                                                <div className="flex items-center gap-1">
                                                  <Input
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    onKeyDown={handleKeyPress}
                                                    onBlur={saveEdit}
                                                    autoFocus
                                                    className="h-6 text-xs px-1 py-0"
                                                    type={
                                                      field.type === "number"
                                                        ? "number"
                                                        : field.type === "date"
                                                          ? "date"
                                                          : "text"
                                                    }
                                                  />
                                                </div>
                                              ) : (
                                                <div
                                                  className="cursor-pointer hover:bg-gray-100 rounded px-1 py-1 min-h-[20px] flex items-center justify-between group"
                                                  onClick={() => startEditing(index, field.id, cellValue)}
                                                  title="Click to edit"
                                                >
                                                  <span className={`${isTargetField ? "font-medium" : ""}`}>
                                                    {cellValue === null ? (
                                                      <span className="text-gray-400 italic">null</span>
                                                    ) : cellValue === "" ? (
                                                      <span className="text-gray-400 italic">empty</span>
                                                    ) : (
                                                      String(cellValue)
                                                    )}
                                                    {isTargetField && <span className="ml-1 text-red-500">⚠️</span>}
                                                  </span>
                                                  <span className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 ml-1">
                                                    ✏️
                                                  </span>
                                                </div>
                                              )}
                                            </td>
                                          )
                                        })}
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>

                            {(selectedTestType ? filteredData : generatedData).length > 10 && (
                              <div className="mt-2 text-center">
                                <Badge variant="outline">
                                  Showing 10 of {(selectedTestType ? filteredData : generatedData).length} records
                                </Badge>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Click "Generate Test Data" to create sample data based on your field configurations.</p>
                          </div>
                        )}

                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">JSON Preview:</p>
                            {selectedTestType && (
                              <Badge variant="secondary" className="text-xs">
                                {selectedTestType === "positive"
                                  ? "✅ Positive"
                                  : selectedTestType === "negative"
                                    ? "❌ Negative"
                                    : "🤖 Auto"}{" "}
                                Sample
                              </Badge>
                            )}
                          </div>
                          <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
                            {JSON.stringify((selectedTestType ? filteredData : generatedData)[0], null, 2)}
                          </pre>

                          {selectedTestType === "negative" && filteredData[0]?._targetField && (
                            <div className="mt-2 p-2 bg-red-50 rounded text-xs">
                              <p className="font-medium text-red-800">🎯 Target Field Analysis:</p>
                              <p className="text-red-700">
                                Field: <code className="bg-red-100 px-1 rounded">{filteredData[0]._targetField}</code> |
                                Test: <code className="bg-red-100 px-1 rounded">{filteredData[0]._testType}</code> |
                                Value:{" "}
                                <code className="bg-red-100 px-1 rounded">
                                  {filteredData[0][filteredData[0]._targetField]}
                                </code>
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
