import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - List all containers
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("containers")
      .select("*")
      .order("name");

    if (error) throw error;

    return NextResponse.json({ containers: data });
  } catch (error) {
    console.error("Error fetching containers:", error);
    return NextResponse.json(
      { error: "Failed to fetch containers" },
      { status: 500 }
    );
  }
}

// POST - Create a new container
export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Container name is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("containers")
      .insert({ name: name.trim().toLowerCase() })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A container with this name already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ container: data });
  } catch (error) {
    console.error("Error creating container:", error);
    return NextResponse.json(
      { error: "Failed to create container" },
      { status: 500 }
    );
  }
}

// PUT - Update a container
export async function PUT(request: NextRequest) {
  try {
    const { id, name } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Container ID is required" },
        { status: 400 }
      );
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Container name is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("containers")
      .update({ name: name.trim().toLowerCase() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A container with this name already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ container: data });
  } catch (error) {
    console.error("Error updating container:", error);
    return NextResponse.json(
      { error: "Failed to update container" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a container
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Container ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("containers")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting container:", error);
    return NextResponse.json(
      { error: "Failed to delete container" },
      { status: 500 }
    );
  }
}

