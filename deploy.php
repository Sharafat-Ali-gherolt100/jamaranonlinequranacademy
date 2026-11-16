<?php
header("Content-Type: application/json");

$secret = "JamaranDeploy2026";
$providedSecret = $_GET['secret'] ?? $_POST['secret'] ?? $_SERVER['HTTP_X_DEPLOY_SECRET'] ?? '';

if ($providedSecret !== $secret) {
    http_response_code(403);
    echo json_encode(["success" => false, "message" => "Unauthorized"]);
    exit;
}

$repoPath = "/home/jamranqu/repositories/jamaranonlinequranacademy";
$deployPath = "/home/jamranqu/public_html";

$gitOutput = shell_exec("git -C " . escapeshellarg($repoPath) . " pull origin main 2>&1");
$cpOutput = shell_exec("/bin/cp -rf " . escapeshellarg($repoPath) . "/* " . escapeshellarg($deployPath) . "/ 2>&1");

echo json_encode([
    "success" => true,
    "message" => "Files synchronized via deploy.php",
    "git" => $gitOutput,
    "cp" => $cpOutput
]);
