' PowerPoint 슬라이드를 PNG로 내보내기 (늦은 바인딩)
Dim app, pres, i, outDir, fso
Set fso = CreateObject("Scripting.FileSystemObject")
outDir = WScript.Arguments(1)
If Not fso.FolderExists(outDir) Then fso.CreateFolder(outDir)
Set app = CreateObject("PowerPoint.Application")
Set pres = app.Presentations.Open(WScript.Arguments(0), True, False, False)
For i = 1 To pres.Slides.Count
  pres.Slides(i).Export outDir & "\s" & Right("0" & i, 2) & ".png", "PNG", 1333, 750
Next
WScript.Echo "exported " & pres.Slides.Count
pres.Close
app.Quit
