import { NextFunction, Request, Response } from "express"
import { getConnection, getManager, getRepository } from "typeorm"
import { GroupStudent } from "../entity/group-student.entity"
import { Group } from "../entity/group.entity"
import { Roll } from "../entity/roll.entity"
import { StudentRollState } from "../entity/student-roll-state.entity"
import { CreateGroupStudentInput } from "../interface/group-student.interface"
import { CreateGroupInput, UpdateGroupInput } from "../interface/group.interface"

export class GroupController {
  private groupRepository = getRepository(Group)
  private groupStudentRepository = getRepository(GroupStudent)

  async allGroups(request: Request, response: Response, next: NextFunction) {
    // Return the list of all groups
    return this.groupRepository.find()
  }

  async createGroup(request: Request, response: Response, next: NextFunction) {
    // Add a Group
    const { body: params } = request

    // TODO We can add input validation and api response error handling here.

    const createGroupInput: CreateGroupInput = {
      name: params.name,
      number_of_weeks: params.number_of_weeks,
      incidents: params.incidents,
      ltmt: params.ltmt,
      roll_states: params.roll_states,
    }

    const group = new Group()
    group.prepareToCreate(createGroupInput)

    return this.groupRepository.save(group)
  }

  async updateGroup(request: Request, response: Response, next: NextFunction) {
    // Update a Group
    const { body: params } = request

    return this.groupRepository.findOne(params.id).then((group) => {
      const updateStudentInput: UpdateGroupInput = {
        id: params.id,
        name: params.name,
        incidents: params.incidents,
        number_of_weeks: params.number_of_weeks,
        ltmt: params.ltmt,
        roll_states: params.roll_states,
      }

      group.prepareToUpdate(updateStudentInput)

      return this.groupRepository.save(group)
    })
  }

  async removeGroup(request: Request, response: Response, next: NextFunction) {
    // Delete a Group
    let groupToRemove = await this.groupRepository.findOne(request.params.id)
    return await this.groupRepository.remove(groupToRemove)
  }

  async getGroupStudents(request: Request, response: Response, next: NextFunction) {
    // Return the list of Students that are in a Group
    const studentData = []
    if (request.params.id) {
      const groupStudentData = await getRepository("group_student")
        .createQueryBuilder("group_student")
        .innerJoinAndSelect("group_student.student", "student")
        .where("group_student.group_id = :group_id", { group_id: request.params.id })
        .getMany()

      // fetch student's personal data
      groupStudentData.forEach(<GroupStudent>(element) => {
        studentData.push({
          id: element.student.id,
          first_name: element.student.first_name,
          last_name: element.student.last_name,
          full_name: `${element.student.first_name} ${element.student.last_name}`,
        })
      })

      return studentData
    }

    return []
  }

  async runGroupFilters(request: Request, response: Response, next: NextFunction) {
    // 1. Clear out the groups (delete all the students from the groups)
    const clearedTable = await this.groupStudentRepository.delete({})
    const groupsData = await this.groupRepository.find()
    const mainData = []

    // 2. For each group, query the student rolls to see which students match the filter for the group
    for (const grp of groupsData) {
      const validStates: Array<any> = grp.roll_states && grp.roll_states.length > 1 ? grp.roll_states.split(",") : []
      const operator = grp.ltmt

      const todaysDate = new Date()
      // find valid starting date considering n no of weeks
      const validStartingDate = new Date(todaysDate.getTime() - grp.number_of_weeks * 7 * (1000 * 60 * 60 * 24))

      const filteredData = await getManager()
        .createQueryBuilder(StudentRollState, "studentRollState")
        .select(["studentRollState.student_id"])
        .addSelect("COUNT(*)", "count")
        .innerJoin(Roll, "roll", "roll.id = studentRollState.roll_id")
        .where("roll.completed_at >= :date", { date: validStartingDate })
        .andWhere("studentRollState.state IN (:...validStates)", { validStates })
        .groupBy("studentRollState.student_id")
        .having(`COUNT(*) ${operator} :count`, { count: grp.incidents })
        .getRawMany()

      // update the run time data for group
      await getConnection().createQueryBuilder().update(Group).set({ run_at: new Date(), student_count: filteredData.length }).where("id = :id", { id: grp.id }).execute()
      mainData.push(filteredData)

      // 3. Add the list of students that match the filter to the group
      for (const data of filteredData) {
        const createGroupStudentInput: CreateGroupStudentInput = {
          group_id: grp.id,
          incident_count: data.count,
          student_id: data.studentRollState_student_id,
        }

        const group = new GroupStudent()
        group.prepareToCreate(createGroupStudentInput)

        this.groupStudentRepository.save(group)
      }
    }

    return "Group filter executed successfully."
  }
}
