#!/bin/bash
# Script to push Inventory Management System to GitHub

cd "$(dirname "$0")"

echo "🚀 Pushing to GitHub..."

# Add remote (if not already added)
if ! git remote | grep -q origin; then
    echo "📡 Adding GitHub remote..."
    git remote add origin https://github.com/gopalnist/InventoryManagementSystem.git
else
    echo "✅ Remote already configured"
    git remote set-url origin https://github.com/gopalnist/InventoryManagementSystem.git
fi

# Switch to main branch
git branch -M main

# Push to GitHub
echo "📤 Pushing code to GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo "🌐 Repository: https://github.com/gopalnist/InventoryManagementSystem"
else
    echo ""
    echo "❌ Push failed. Make sure:"
    echo "   1. Repository exists at: https://github.com/gopalnist/InventoryManagementSystem"
    echo "   2. You have push access"
    echo "   3. You're authenticated (gh auth login)"
fi
