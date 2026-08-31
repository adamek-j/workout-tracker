package com.adamekj.workouttracker.exercise;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("api/exercises")
public class ExerciseController {

    @GetMapping
    public List<ExerciseResponse> getExercises(){
        return List.of(
                new ExerciseResponse(1L, "Incine Bench Press"),
                new ExerciseResponse(2L, "Machine Chest Press"),
                new ExerciseResponse(3L, "Lat Pulldown")
        );
    }
}
