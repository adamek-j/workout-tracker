package com.adamekj.workouttracker.exercise;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/exercises")
public class ExerciseController {

    @GetMapping
    public List<ExerciseResponse> getExercises() {
        return List.of(
                exercise(1, "Incline Bench Press", "CHEST"),
                exercise(2, "Machine Chest Press / Flat Bench Press", "CHEST"),
                exercise(3, "Lat Pulldown", "BACK"),
                exercise(4, "Machine Pec Deck", "CHEST"),
                exercise(5, "Half-Kneeling One-Arm Lat Pulldown", "BACK"),
                exercise(6, "Chest Supported T-Bar Row / DB Row", "BACK"),
                exercise(7, "Cable Row", "BACK"),
                exercise(8, "Reverse Pec Deck", "BACK", "SHOULDERS"),
                exercise(9, "Dumbbell Shrugs", "BACK"),
                exercise(10, "Pull-ups", "BACK"),
                exercise(11, "Incline Dumbbell Curl", "BICEPS"),
                exercise(12, "Preacher Curl (DB / Machine)", "BICEPS"),
                exercise(13, "Face-Away Bayesian Curl", "BICEPS"),
                exercise(14, "Standing Cable Curl", "BICEPS"),
                exercise(15, "Overhead Cable Triceps Extension", "TRICEPS"),
                exercise(16, "Cable Triceps Pushdown (Bar / Rope)", "TRICEPS"),
                exercise(17, "Dumbbell Overhead Press", "SHOULDERS"),
                exercise(18, "Cable / Dumbbell Lateral Raise", "SHOULDERS"),
                exercise(19, "Walking Lunge", "LEGS", "GLUTES"),
                exercise(20, "Leg Extension", "LEGS"),
                exercise(21, "Seated Leg Curl", "LEGS"),
                exercise(22, "Seated / Standing Calf Raise", "LEGS"),
                exercise(23, "Deadlift", "LEGS", "GLUTES"),
                exercise(24, "Squat", "LEGS"),
                exercise(25, "Hip Abduction Machine", "GLUTES"),
                exercise(26, "Machine Hip Thrust", "GLUTES"),
                exercise(27, "45-Degree Back Extension", "GLUTES"),
                exercise(28, "Cable Crunch", "CORE"),
                exercise(29, "Dumbbell Wrist Curls / Extensions", "FOREARMS"),
                exercise(30, "Neck Curls / Extensions", "NECK")
        );
    }

    private ExerciseResponse exercise(
            long id,
            String name,
            String... muscleGroups
    ) {
        return new ExerciseResponse(id, name, List.of(muscleGroups));
    }
}