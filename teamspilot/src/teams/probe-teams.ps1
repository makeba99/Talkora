$ErrorActionPreference = "Stop"
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$result = [ordered]@{
  teamsWindowFound = $false
  processName = $null
  windowTitle = $null
  selectedLabels = @()
  composerFound = $false
  messageTextExposed = $false
  inspectedElements = 0
  notes = @("This probe does not type, click, or send.")
}

$procs = @(Get-Process | Where-Object { $_.ProcessName -in @("ms-teams", "Teams") -and $_.MainWindowHandle -ne 0 })
if ($procs.Count -eq 0) {
  $result.notes += "No Teams window with a main handle was found."
  $result | ConvertTo-Json -Compress -Depth 4
  exit 0
}

$proc = $procs[0]
$result.processName = [string]$proc.ProcessName
$root = [System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle)
if ($null -eq $root) {
  $result.notes += "Teams is running, but UI Automation could not read the window."
  $result | ConvertTo-Json -Compress -Depth 4
  exit 0
}

$result.teamsWindowFound = $true
$result.windowTitle = [string]$root.Current.Name
$queue = New-Object System.Collections.Generic.Queue[object]
$queue.Enqueue(@{ Element = $root; Depth = 0 })
$max = 250

while ($queue.Count -gt 0 -and $result.inspectedElements -lt $max) {
  $item = $queue.Dequeue()
  $el = $item.Element
  $depth = [int]$item.Depth
  $result.inspectedElements = [int]$result.inspectedElements + 1
  try {
    $name = [string]$el.Current.Name
    $ctype = [string]$el.Current.ControlType.ProgrammaticName
  } catch {
    continue
  }
  if ($ctype -eq "ControlType.Edit") { $result.composerFound = $true }
  if ($ctype -eq "ControlType.Text" -and $name.Length -gt 0 -and $depth -ge 3) { $result.messageTextExposed = $true }
  if ($ctype -eq "ControlType.ListItem" -and $name.Length -gt 0) {
    try {
      $pattern = $el.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
      if ($pattern.Current.IsSelected) {
        $result.selectedLabels += $name
      }
    } catch {
    }
  }
  if ($depth -lt 5) {
    try {
      $children = $el.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
      foreach ($child in $children) {
        $queue.Enqueue(@{ Element = $child; Depth = ($depth + 1) })
      }
    } catch {
    }
  }
}

if ($result.selectedLabels.Count -eq 0) {
  $result.notes += "No selected chat item was exposed."
}
$result | ConvertTo-Json -Compress -Depth 4
