import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, ManyToOne } from "typeorm"
import { CreateGroupStudentInput } from "../interface/group-student.interface"
import { Student } from "./student.entity"

@Entity()
export class GroupStudent {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  student_id: number

  @Column()
  group_id: number

  @Column()
  incident_count: number

  @ManyToOne((type) => Student, (student) => student.id)
  @JoinColumn({
    name: "student_id",
  })
  student: Student

  public prepareToCreate(input: CreateGroupStudentInput) {
    this.incident_count = input.incident_count
    this.student_id = input.student_id
    this.group_id = input.group_id
  }
}
