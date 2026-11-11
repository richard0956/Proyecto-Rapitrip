param([string]$Stem = 'modelo_entidad_relacion')
Add-Type -AssemblyName System.Drawing

$svgPath = Join-Path $PSScriptRoot ($Stem + '.svg')
$pngPath = Join-Path $PSScriptRoot ($Stem + '.png')
[xml]$doc = Get-Content -LiteralPath $svgPath -Raw -Encoding UTF8
$root = $doc.DocumentElement
$width = [int]$root.GetAttribute('width')
$height = [int]$root.GetAttribute('height')
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.Color]::White)

foreach ($node in $root.ChildNodes) {
    if ($node.LocalName -eq 'rect') {
        $x = [single]$node.GetAttribute('x')
        $y = [single]$node.GetAttribute('y')
        $w = [single]$node.GetAttribute('width')
        $h = [single]$node.GetAttribute('height')
        $fill = [System.Drawing.ColorTranslator]::FromHtml($node.GetAttribute('fill'))
        $brush = New-Object System.Drawing.SolidBrush($fill)
        $graphics.FillRectangle($brush, $x, $y, $w, $h)
        $brush.Dispose()
        if ($node.HasAttribute('stroke')) {
            $stroke = [System.Drawing.ColorTranslator]::FromHtml($node.GetAttribute('stroke'))
            $pen = New-Object System.Drawing.Pen($stroke, 1.5)
            $graphics.DrawRectangle($pen, $x, $y, $w, $h)
            $pen.Dispose()
        }
    }
    elseif ($node.LocalName -eq 'text') {
        $x = [single]$node.GetAttribute('x')
        $y = [single]$node.GetAttribute('y')
        $size = [single]$node.GetAttribute('font-size')
        $weight = if ($node.GetAttribute('font-weight') -eq '700') { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
        $font = New-Object System.Drawing.Font('Arial', $size, $weight, [System.Drawing.GraphicsUnit]::Pixel)
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($node.GetAttribute('fill')))
        $graphics.DrawString($node.InnerText, $font, $brush, $x, ($y - $size * 0.88))
        $font.Dispose()
        $brush.Dispose()
    }
    elseif ($node.LocalName -eq 'polyline') {
        $pointText = $node.GetAttribute('points') -split '\s+'
        $points = @($pointText | Where-Object { $_ } | ForEach-Object {
            $pair = $_ -split ','
            New-Object System.Drawing.PointF([single]$pair[0], [single]$pair[1])
        })
        if ($points.Length -gt 1) {
            $color = [System.Drawing.ColorTranslator]::FromHtml($node.GetAttribute('stroke'))
            $color = [System.Drawing.Color]::FromArgb(145, $color.R, $color.G, $color.B)
            $pen = New-Object System.Drawing.Pen($color, [single]$node.GetAttribute('stroke-width'))
            $graphics.DrawLines($pen, [System.Drawing.PointF[]]$points)
            $pen.Dispose()
        }
    }
    elseif ($node.LocalName -eq 'circle') {
        $cx = [single]$node.GetAttribute('cx')
        $cy = [single]$node.GetAttribute('cy')
        $radius = [single]$node.GetAttribute('r')
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($node.GetAttribute('fill')))
        $graphics.FillEllipse($brush, $cx - $radius, $cy - $radius, 2 * $radius, 2 * $radius)
        $brush.Dispose()
    }
}

$bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
Write-Output $pngPath
