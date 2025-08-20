import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { WorkflowMigrationService } from '@/lib/workflow-migration';

// GET /api/admin/workflows/migration - Get migration status and analysis
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permissions
    const userResult = await sql`
      SELECT u.role, r.permissions 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ${session.user.id}
    `;

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const permissions = userResult[0].permissions || [];
    if (!permissions.includes('manage_workflows')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'analyze') {
      // Get current workflow analysis
      const analyses = await WorkflowMigrationService.analyzeCurrentWorkflows();
      
      return NextResponse.json({
        success: true,
        analyses
      });

    } else if (action === 'report') {
      // Generate migration report
      const report = await WorkflowMigrationService.generateMigrationReport();
      
      return NextResponse.json({
        success: true,
        report
      });

    } else {
      // Get migration history
      const migrations = await sql`
        SELECT wm.*, wt.name as workflow_name, u.name as migrated_by_name
        FROM workflow_migrations wm
        LEFT JOIN workflow_templates wt ON wm.workflow_id = wt.id
        LEFT JOIN users u ON wm.migrated_by = u.id
        ORDER BY wm.migration_date DESC
      `;

      const formattedMigrations = migrations.map(m => ({
        id: m.id,
        module: m.module,
        workflowId: m.workflow_id,
        workflowName: m.workflow_name,
        migrationDate: m.migration_date,
        rollbackDate: m.rollback_date,
        status: m.status,
        migrationNotes: m.migration_notes,
        migratedBy: m.migrated_by,
        migratedByName: m.migrated_by_name,
        backupFiles: m.backup_files ? JSON.parse(m.backup_files) : [],
        analysisData: m.analysis_data ? JSON.parse(m.analysis_data) : null
      }));

      return NextResponse.json({
        success: true,
        migrations: formattedMigrations
      });
    }

  } catch (error) {
    console.error('Error in migration API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/workflows/migration - Execute migration
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permissions
    const userResult = await sql`
      SELECT u.role, r.permissions 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ${session.user.id}
    `;

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const permissions = userResult[0].permissions || [];
    if (!permissions.includes('manage_workflows')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { module, createBackup, migrationNotes } = body;

    if (!module) {
      return NextResponse.json(
        { error: 'Module is required' },
        { status: 400 }
      );
    }

    // Check if already migrated
    const existingMigration = await sql`
      SELECT id FROM workflow_migrations 
      WHERE module = ${module} AND status = 'completed'
    `;

    if (existingMigration.length > 0) {
      return NextResponse.json(
        { error: 'Module already migrated. Use rollback first if needed.' },
        { status: 409 }
      );
    }

    // Create migration record
    const migrationRecord = await sql`
      INSERT INTO workflow_migrations (
        module, status, migration_notes, migrated_by
      ) VALUES (
        ${module}, 'in_progress', ${migrationNotes || null}, ${session.user.id}
      ) RETURNING id
    `;

    const migrationId = migrationRecord[0].id;

    try {
      // Execute migration
      const result = await WorkflowMigrationService.executeMigration(
        module, 
        createBackup ?? true
      );

      if (result.success) {
        // Update migration record
        await sql`
          UPDATE workflow_migrations 
          SET 
            status = 'completed',
            workflow_id = ${result.workflowId},
            backup_files = ${JSON.stringify(result.backupFiles || [])},
            updated_at = NOW()
          WHERE id = ${migrationId}
        `;

        return NextResponse.json({
          success: true,
          message: result.message,
          migrationId,
          workflowId: result.workflowId,
          backupFiles: result.backupFiles
        }, { status: 201 });

      } else {
        // Mark as failed
        await sql`
          UPDATE workflow_migrations 
          SET status = 'failed', updated_at = NOW()
          WHERE id = ${migrationId}
        `;

        return NextResponse.json(
          { 
            success: false,
            error: 'Migration failed',
            message: result.message,
            migrationId
          },
          { status: 500 }
        );
      }

    } catch (migrationError) {
      // Mark as failed
      await sql`
        UPDATE workflow_migrations 
        SET status = 'failed', updated_at = NOW()
        WHERE id = ${migrationId}
      `;

      throw migrationError;
    }

  } catch (error) {
    console.error('Error executing migration:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Migration execution failed',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/workflows/migration - Rollback migration
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permissions
    const userResult = await sql`
      SELECT u.role, r.permissions 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ${session.user.id}
    `;

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const permissions = userResult[0].permissions || [];
    if (!permissions.includes('manage_workflows')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const module = searchParams.get('module');

    if (!module) {
      return NextResponse.json(
        { error: 'Module parameter is required' },
        { status: 400 }
      );
    }

    // Execute rollback
    const result = await WorkflowMigrationService.rollbackMigration(module);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message
      });
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: 'Rollback failed',
          message: result.message 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error rolling back migration:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Rollback failed',
        message: error.message 
      },
      { status: 500 }
    );
  }
}