"""Google Tasks API service functions"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from googleapiclient.discovery import build
from fastapi import HTTPException

from .service import get_creds, _creds
from .rate_limit import acquire


def get_tasks_service(uid: str):
    """Build Google Tasks API service with user credentials."""
    row = get_creds(uid)
    if not row:
        raise HTTPException(400, "Google account not connected")
    
    acquire(uid)  # Rate limiting
    credentials = _creds(row)
    return build("tasks", "v1", credentials=credentials)


def list_task_lists(uid: str) -> List[Dict[str, Any]]:
    """
    List all task lists for the user.
    Returns: List of task lists with id, title, updated timestamp.
    """
    try:
        service = get_tasks_service(uid)
        result = service.tasklists().list().execute()
        return result.get("items", [])
    except Exception as e:
        print(f"Error listing task lists: {e}")
        raise HTTPException(500, f"Failed to fetch task lists: {str(e)}")


def list_tasks(uid: str, tasklist_id: str = "@default", show_completed: bool = False) -> List[Dict[str, Any]]:
    """
    List tasks from a specific task list.
    
    Args:
        uid: User ID
        tasklist_id: Task list ID (default: "@default" for default list)
        show_completed: Whether to include completed tasks
    
    Returns:
        List of tasks with id, title, notes, status, due, completed, etc.
    """
    try:
        service = get_tasks_service(uid)
        
        params = {
            "tasklist": tasklist_id,
            "showCompleted": show_completed,
            "showHidden": False,
        }
        
        result = service.tasks().list(**params).execute()
        return result.get("items", [])
    except Exception as e:
        print(f"Error listing tasks: {e}")
        raise HTTPException(500, f"Failed to fetch tasks: {str(e)}")


def get_all_tasks(uid: str, show_completed: bool = False) -> List[Dict[str, Any]]:
    """
    Get all tasks from all task lists.
    
    Args:
        uid: User ID
        show_completed: Whether to include completed tasks
    
    Returns:
        List of all tasks across all task lists
    """
    try:
        all_tasks = []
        task_lists = list_task_lists(uid)
        
        for task_list in task_lists:
            tasks = list_tasks(uid, task_list["id"], show_completed)
            
            # Add task list name to each task for context
            for task in tasks:
                task["task_list_name"] = task_list.get("title", "Untitled List")
                task["task_list_id"] = task_list["id"]
            
            all_tasks.extend(tasks)
        
        return all_tasks
    except Exception as e:
        print(f"Error getting all tasks: {e}")
        raise HTTPException(500, f"Failed to fetch all tasks: {str(e)}")


def create_task(uid: str, title: str, notes: str = None, due: str = None, tasklist_id: str = "@default") -> Dict[str, Any]:
    """
    Create a new task.
    
    Args:
        uid: User ID
        title: Task title
        notes: Task description/notes
        due: Due date in RFC 3339 format (e.g., "2024-12-31T23:59:59Z")
        tasklist_id: Task list ID (default: "@default")
    
    Returns:
        Created task object
    """
    try:
        service = get_tasks_service(uid)
        
        task_body = {
            "title": title,
        }
        
        if notes:
            task_body["notes"] = notes
        
        if due:
            task_body["due"] = due
        
        result = service.tasks().insert(tasklist=tasklist_id, body=task_body).execute()
        return result
    except Exception as e:
        print(f"Error creating task: {e}")
        raise HTTPException(500, f"Failed to create task: {str(e)}")


def update_task(uid: str, task_id: str, title: str = None, notes: str = None, 
                due: str = None, status: str = None, tasklist_id: str = "@default") -> Dict[str, Any]:
    """
    Update an existing task.
    
    Args:
        uid: User ID
        task_id: Task ID to update
        title: New task title
        notes: New task description/notes
        due: New due date in RFC 3339 format
        status: Task status ("needsAction" or "completed")
        tasklist_id: Task list ID (default: "@default")
    
    Returns:
        Updated task object
    """
    try:
        service = get_tasks_service(uid)
        
        # First, get the current task
        task = service.tasks().get(tasklist=tasklist_id, task=task_id).execute()
        
        # Update fields
        if title is not None:
            task["title"] = title
        if notes is not None:
            task["notes"] = notes
        if due is not None:
            task["due"] = due
        if status is not None:
            task["status"] = status
        
        result = service.tasks().update(tasklist=tasklist_id, task=task_id, body=task).execute()
        return result
    except Exception as e:
        print(f"Error updating task: {e}")
        raise HTTPException(500, f"Failed to update task: {str(e)}")


def delete_task(uid: str, task_id: str, tasklist_id: str = "@default") -> Dict[str, str]:
    """
    Delete a task.
    
    Args:
        uid: User ID
        task_id: Task ID to delete
        tasklist_id: Task list ID (default: "@default")
    
    Returns:
        Success message
    """
    try:
        service = get_tasks_service(uid)
        service.tasks().delete(tasklist=tasklist_id, task=task_id).execute()
        return {"status": "success", "message": "Task deleted"}
    except Exception as e:
        print(f"Error deleting task: {e}")
        raise HTTPException(500, f"Failed to delete task: {str(e)}")


def complete_task(uid: str, task_id: str, tasklist_id: str = "@default") -> Dict[str, Any]:
    """
    Mark a task as completed.
    
    Args:
        uid: User ID
        task_id: Task ID to complete
        tasklist_id: Task list ID (default: "@default")
    
    Returns:
        Updated task object
    """
    return update_task(uid, task_id, status="completed", tasklist_id=tasklist_id)

