import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export interface Teacher {
    id: string
    user_id: string
    employee_id_number?: string
    hire_date?: string
    department?: string
    first_name: string
    last_name: string
    email: string
}

export async function getTeachers(): Promise<Teacher[]> {
    try {
        // Fetch teachers and users separately because of PGRST200 error (missing relationship in cache)
        const { data: teachersData, error: teachersError } = await supabase
            .from('teachers')
            .select('id, user_id, employee_id_number, hire_date, department')

        if (teachersError) {
            logger.error('Error fetching teachers:', teachersError)
            return []
        }

        if (!teachersData || teachersData.length === 0) return []

        const userIds = teachersData.map((t: any) => t.user_id)
        const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, first_name, last_name, email')
            .in('id', userIds)

        if (usersError) {
            logger.error('Error fetching users for teachers:', usersError)
        }

        const userMap = new Map((usersData || []).map((u: any) => [u.id, u]))

        return teachersData.map((t: any) => {
            const user = userMap.get(t.user_id)
            return {
                id: t.id,
                user_id: t.user_id,
                employee_id_number: t.employee_id_number,
                hire_date: t.hire_date,
                department: t.department,
                first_name: user?.first_name || 'Professor',
                last_name: user?.last_name || '',
                email: user?.email || ''
            }
        })
    } catch (error) {
        logger.error('Network error fetching teachers:', error)
        return []
    }
}

export async function getTeacherByUserId(userId: string): Promise<Teacher | null> {
    try {
        const { data: teacherData, error: teacherError } = await supabase
            .from('teachers')
            .select('id, user_id, employee_id_number, hire_date, department')
            .eq('user_id', userId)
            .single()

        if (teacherError) {
            if (teacherError.code !== 'PGRST116') {
                logger.error('Error fetching teacher by user ID:', teacherError)
            }
            return null
        }

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, first_name, last_name, email')
            .eq('id', userId)
            .single()

        return {
            id: teacherData.id,
            user_id: teacherData.user_id,
            employee_id_number: teacherData.employee_id_number,
            hire_date: teacherData.hire_date,
            department: teacherData.department,
            first_name: userData?.first_name || 'Professor',
            last_name: userData?.last_name || '',
            email: userData?.email || ''
        }
    } catch (error) {
        logger.error('Network error fetching teacher by user ID:', error)
        return null
    }
}
