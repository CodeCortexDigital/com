<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {

    $name    = htmlspecialchars(trim($_POST["name"]));
    $email   = htmlspecialchars(trim($_POST["email"]));
    $message = htmlspecialchars(trim($_POST["message"]));

    if (empty($name) || empty($email) || empty($message)) {
        echo "Please fill all fields.";
        exit;
    }

    $to = "info@codecortexdigital.com";   // receiving email
    $subject = "New Contact Form Message - Code Cortex";

    $body = "
    Name: $name\n
    Email: $email\n
    Message:\n$message
    ";

    $headers = "From: $email\r\nReply-To: $email";

    if (mail($to, $subject, $body, $headers)) {
        echo "Thank you! Your message has been sent.";
    } else {
        echo "Error sending message. Please try again later.";
    }
}
?>
