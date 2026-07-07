export function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email) ? "" : "Please enter a valid email address.";
}

export function validateRequirementLength(text) {
    if (!text || text.trim().length < 50)
        return "Requirement details must be at least 50 characters for AI to generate useful tasks.";
    return "";
}

export function validateRequired(value, fieldName = "This field") {
    if (!value || !value.toString().trim())
        return `${fieldName} is required.`;
    return "";
}